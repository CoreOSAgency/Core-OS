import { NextResponse } from "next/server";
import { systemPrompts } from "@/lib/systemPrompts";
import { createClient } from "@/lib/supabase/server";
import {
  extractContextBlock,
  extractDeliverableFlag,
  SHARED_AGENT_BEHAVIOR,
} from "@/lib/agencyContext";
import {
  formatProjectContextForPrompt,
  getProjectContext,
  saveProjectContext,
} from "@/lib/projects";

type ChatTurn = { role: "user" | "model"; text: string };

// ponytail: gemini-2.5-flash (as originally requested) is rejected by this
// API key's project tier ("no longer available to new users" — verified live
// against the API on 2026-08-29). gemini-3.6-flash is Google's own suggested
// replacement and was verified working. Swap the model string here if a
// different one becomes preferred.
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const agentId: unknown = body?.agentId;
  const message: unknown = body?.message;
  const projectId: unknown = body?.projectId;
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

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

  const baseSystemPrompt = systemPrompts[agentId];
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

  const contents = [
    ...history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });

  const data = await geminiResponse.json().catch(() => null);

  if (!geminiResponse.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Gemini request failed" },
      { status: geminiResponse.status }
    );
  }

  const rawReply: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawReply) {
    return NextResponse.json(
      { error: "Gemini returned no response text" },
      { status: 502 }
    );
  }

  const { text: afterContext, entries } = extractContextBlock(rawReply);
  let contextSaved = false;
  if (entries) {
    await saveProjectContext(supabase, projectId, entries);
    contextSaved = true;
  }

  const { text: reply, isDeliverable } = extractDeliverableFlag(afterContext);

  return NextResponse.json({ reply, contextSaved, isDeliverable });
}
