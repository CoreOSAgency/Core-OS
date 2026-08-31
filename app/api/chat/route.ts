import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/systemPrompts";
import { findAgent } from "@/lib/agents";
import {
  extractGroundingSources,
  getModelConfig,
  type ChatMode,
} from "@/lib/modelRouter";
import { createClient } from "@/lib/supabase/server";
import {
  extractContextBlock,
  extractDeliverableFlag,
  extractHandoffSuggestion,
  SHARED_AGENT_BEHAVIOR,
} from "@/lib/agencyContext";
import {
  formatProjectContextForPrompt,
  getProjectContext,
  saveProjectContext,
} from "@/lib/projects";
import { addParticipant, appendTurn, createConversation } from "@/lib/conversations";

type ChatTurn = {
  role: "user" | "model";
  text: string;
  agentId?: string;
  agentName?: string;
};

const MODES: ChatMode[] = ["quick", "standard", "deep"];

// Model IDs, thinking depth, and tool set per mode all live in lib/modelRouter.
// gemini-2.5-flash was rejected by this key's tier (2026-08-29); the router
// notes which of the current IDs are actually enabled.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }
  const key = apiKey;

  const body = await request.json().catch(() => null);
  const agentId: unknown = body?.agentId;
  const message: unknown = body?.message;
  const projectId: unknown = body?.projectId;
  const conversationId: unknown = body?.conversationId;
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];
  // Absent/unknown mode falls back to 'standard' so older clients still work.
  const mode: ChatMode = MODES.includes(body?.mode) ? body.mode : "standard";

  if (typeof agentId !== "string" || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "agentId and message are required" },
      { status: 400 }
    );
  }
  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json(
      { error: "projectId is required — select or create a project first" },
      { status: 400 }
    );
  }

  const baseSystemPrompt = buildSystemPrompt(agentId, mode);
  if (!baseSystemPrompt) {
    return NextResponse.json(
      { error: `Unknown agentId: ${agentId}` },
      { status: 404 }
    );
  }

  // Middleware already requires a session for /api/*, so this user is real.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS scopes this to projects the caller owns — a foreign/unknown
  // projectId just yields empty context rather than needing a separate
  // ownership check here.
  const savedContext = await getProjectContext(supabase, projectId);
  const systemPrompt =
    baseSystemPrompt +
    formatProjectContextForPrompt(savedContext) +
    SHARED_AGENT_BEHAVIOR;

  // In a multi-agent thread, label each prior model turn with who said it so
  // the agent answering now knows which lines were someone else talking.
  // No label when it's the same agent (talking to itself).
  const contents = [
    ...history.map((turn) => {
      const label =
        turn.role === "model" && turn.agentId && turn.agentId !== agentId
          ? `[${turn.agentName ?? turn.agentId}]: `
          : "";
      return { role: turn.role, parts: [{ text: label + turn.text }] };
    }),
    { role: "user", parts: [{ text: message }] },
  ];

  const config = getModelConfig(mode);

  const geminiBody: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      thinkingConfig: { thinkingLevel: config.thinkingLevel },
      maxOutputTokens: config.maxOutputTokens,
    },
  };
  if (config.tools.length > 0) {
    geminiBody.tools = config.tools.map((t) => ({ [t.type]: {} }));
  }
  const requestBody = JSON.stringify(geminiBody);

  async function callGemini(model: string) {
    const res = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      }
    );
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }

  // Try the mode's model; on any failure retry once against the fallback so a
  // bad/disabled model ID (e.g. Pro not enabled on the key) degrades instead
  // of 500ing. model_used records which one actually answered.
  let modelUsed = config.model;
  let result: Awaited<ReturnType<typeof callGemini>>;
  try {
    result = await callGemini(config.model);
    if (!result.ok) {
      throw new Error(
        result.json?.error?.message ?? `Gemini HTTP ${result.status}`
      );
    }
  } catch (err) {
    console.warn(
      `[chat] ${config.model} failed, falling back to ${config.fallbackModel}`,
      err
    );
    modelUsed = config.fallbackModel;
    try {
      result = await callGemini(config.fallbackModel);
    } catch (err2) {
      return NextResponse.json(
        { error: err2 instanceof Error ? err2.message : "Gemini request failed" },
        { status: 502 }
      );
    }
  }

  const data = result.json;

  if (!result.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Gemini request failed" },
      { status: result.status || 502 }
    );
  }

  // Grounded replies can arrive split across several parts — join them all.
  const parts: Array<{ text?: string }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const rawReply = parts.map((p) => p.text ?? "").join("").trim();

  if (!rawReply) {
    return NextResponse.json(
      { error: "Gemini returned no response text" },
      { status: 502 }
    );
  }

  const groundingSources = extractGroundingSources(data);

  const { text: afterContext, entries } = extractContextBlock(rawReply);
  let contextSaved = false;
  if (entries) {
    await saveProjectContext(supabase, projectId, entries);
    contextSaved = true;
  }

  const { text: afterDeliverable, isDeliverable } =
    extractDeliverableFlag(afterContext);

  // A handoff suggestion only counts if it names a real agent that isn't the
  // one who just answered.
  const { text: reply, suggestedAgentId: rawSuggestion } =
    extractHandoffSuggestion(afterDeliverable);
  const suggestedAgentId =
    rawSuggestion && rawSuggestion !== agentId && findAgent(rawSuggestion)
      ? rawSuggestion
      : null;

  // Persist the turn. A conversation is created on first message in a
  // fresh chat; the client tracks the id from here for the rest of it.
  const activeConversationId =
    typeof conversationId === "string" && conversationId
      ? conversationId
      : (await createConversation(supabase, projectId, agentId)).id;

  await appendTurn(supabase, activeConversationId, message, reply, {
    contextSaved,
    isDeliverable,
    mode,
    modelUsed,
    thinkingLevel: config.thinkingLevel,
    groundingSources,
    agentId,
  });

  // The first time an agent answers in a thread, it becomes a participant.
  // This is what makes a thread "become" multi-agent, no separate action.
  await addParticipant(supabase, activeConversationId, agentId);

  return NextResponse.json({
    reply,
    contextSaved,
    isDeliverable,
    conversationId: activeConversationId,
    groundingSources,
    suggestedAgentId,
  });
}
