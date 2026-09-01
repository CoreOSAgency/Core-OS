import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/systemPrompts";
import { findAgent } from "@/lib/agents";
import {
  extractGroundingSources,
  getModelConfig,
  shouldUseTools,
  type ChatMode,
} from "@/lib/modelRouter";
import { createClient } from "@/lib/supabase/server";
import {
  extractContextBlock,
  extractDeliverableFlag,
  extractHandoffSuggestion,
  extractSlideImagePrompts,
  SHARED_AGENT_BEHAVIOR,
} from "@/lib/agencyContext";
import {
  formatProjectContextForPrompt,
  getProjectContext,
  saveProjectContext,
} from "@/lib/projects";
import { addParticipant, appendTurn, createConversation } from "@/lib/conversations";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  // Files/voice notes: the client uploads bytes to Storage and passes paths
  // here; the route pulls them for Gemini and records them on the message.
  type IncomingAttachment = { storagePath: string; mimeType: string; fileName: string };
  const attachmentRefs: IncomingAttachment[] = Array.isArray(body?.attachments)
    ? body.attachments.filter(
        (a: unknown): a is IncomingAttachment =>
          !!a &&
          typeof (a as IncomingAttachment).storagePath === "string" &&
          typeof (a as IncomingAttachment).mimeType === "string"
      )
    : [];

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

  // Pull attachment bytes from Storage (RLS scopes this to the caller's own
  // files) and hand them to Gemini as inline_data on the user turn.
  const inlineParts: { inline_data: { mime_type: string; data: string } }[] = [];
  const storedAttachments: { storage_path: string; mime_type: string; file_name: string }[] = [];
  for (const ref of attachmentRefs) {
    const { data: blob, error } = await supabase.storage
      .from("chat-attachments")
      .download(ref.storagePath);
    if (error || !blob) continue;
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    inlineParts.push({ inline_data: { mime_type: ref.mimeType, data: b64 } });
    storedAttachments.push({
      storage_path: ref.storagePath,
      mime_type: ref.mimeType,
      file_name: ref.fileName || ref.storagePath.split("/").pop() || "file",
    });
  }

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
    { role: "user", parts: [{ text: message }, ...inlineParts] },
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
  if (config.tools.length > 0 && shouldUseTools(mode, message)) {
    geminiBody.tools = config.tools.map((t) => ({ [t.type]: {} }));
  }
  const requestBody = JSON.stringify(geminiBody);

  // Streams the model in real time as Server-Sent Events. Event shapes:
  //   {t:"text", v}         a chunk of the visible reply
  //   {t:"search", v}       a web search query the model ran
  //   {t:"read", v}         a source it pulled in
  //   {t:"done", ...}       final: cleaned reply + persisted-turn metadata
  //   {t:"error", v}        something failed
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let rawReply = "";
      let lastGroundingChunk: unknown = null;
      const seenReads = new Set<string>();
      const seenSearches = new Set<string>();
      let modelUsed = config.model;

      // Reads one streamGenerateContent SSE response, emitting text/search/read
      // events. Returns true if it produced any text.
      async function pump(model: string): Promise<boolean> {
        const res = await fetch(
          `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          }
        );
        if (!res.ok || !res.body) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error?.message ?? `Gemini HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let produced = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let chunk: {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string; thought?: boolean }> };
                groundingMetadata?: {
                  webSearchQueries?: string[];
                  groundingChunks?: Array<{ web?: { title?: string } }>;
                };
              }>;
            };
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }
            const cand = chunk.candidates?.[0];
            for (const p of cand?.content?.parts ?? []) {
              if (p.thought || typeof p.text !== "string" || !p.text) continue;
              rawReply += p.text;
              produced = true;
              send({ t: "text", v: p.text });
            }
            const gm = cand?.groundingMetadata;
            if (gm) {
              lastGroundingChunk = chunk;
              for (const q of gm.webSearchQueries ?? []) {
                if (q && !seenSearches.has(q)) {
                  seenSearches.add(q);
                  send({ t: "search", v: q });
                }
              }
              for (const c of gm.groundingChunks ?? []) {
                const title = c?.web?.title;
                if (title && !seenReads.has(title)) {
                  seenReads.add(title);
                  send({ t: "read", v: title });
                }
              }
            }
          }
        }
        return produced;
      }

      try {
        try {
          if (!(await pump(config.model))) throw new Error("empty response");
        } catch (err) {
          console.warn(
            `[chat] ${config.model} stream failed, falling back to ${config.fallbackModel}`,
            err
          );
          rawReply = "";
          lastGroundingChunk = null;
          modelUsed = config.fallbackModel;
          await pump(config.fallbackModel);
        }

        if (!rawReply.trim()) {
          send({ t: "error", v: "The model returned nothing. Try again." });
          controller.close();
          return;
        }

        const groundingSources = extractGroundingSources(lastGroundingChunk);

        const { text: afterContext, entries } = extractContextBlock(rawReply.trim());
        let contextSaved = false;
        if (entries) {
          await saveProjectContext(supabase, projectId, entries);
          contextSaved = true;
        }
        const { text: afterDeliverable, isDeliverable } =
          extractDeliverableFlag(afterContext);
        const { text: afterHandoff, suggestedAgentId: rawSuggestion } =
          extractHandoffSuggestion(afterDeliverable);
        const suggestedAgentId =
          rawSuggestion && rawSuggestion !== agentId && findAgent(rawSuggestion)
            ? rawSuggestion
            : null;
        const { text: reply, images: slideImagePrompts } =
          extractSlideImagePrompts(afterHandoff);

        // The reply already streamed to the user - a persistence hiccup must
        // not turn a good answer into an error. Save best-effort, still send
        // "done" either way.
        let activeConversationId: string | null =
          typeof conversationId === "string" && conversationId ? conversationId : null;
        try {
          if (!activeConversationId) {
            activeConversationId = (
              await createConversation(supabase, projectId, agentId)
            ).id;
          }
          await appendTurn(supabase, activeConversationId, message, reply, {
            contextSaved,
            isDeliverable,
            mode,
            modelUsed,
            thinkingLevel: config.thinkingLevel,
            groundingSources,
            agentId,
            attachments: storedAttachments,
          });
          await addParticipant(supabase, activeConversationId, agentId);
        } catch (persistErr) {
          console.error("[chat] persist failed after stream", persistErr);
        }

        send({
          t: "done",
          reply,
          contextSaved,
          isDeliverable,
          conversationId: activeConversationId,
          groundingSources,
          suggestedAgentId,
          slideImagePrompts,
        });
      } catch (err) {
        send({
          t: "error",
          v: err instanceof Error ? err.message : "Chat request failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
