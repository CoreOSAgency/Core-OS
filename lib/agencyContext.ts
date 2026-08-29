import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAgencyContext(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("agency_context")
    .select("key, value")
    .eq("user_id", userId);

  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

export async function saveAgencyContext(
  supabase: SupabaseClient,
  userId: string,
  entries: Record<string, string>
): Promise<void> {
  const rows = Object.entries(entries)
    .filter(([key, value]) => key && typeof value === "string" && value.trim())
    .map(([key, value]) => ({ user_id: userId, key, value }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("agency_context")
    .upsert(rows, { onConflict: "user_id,key" });

  if (error) throw error;
}

export function formatContextForPrompt(context: Record<string, string>): string {
  const entries = Object.entries(context);
  if (entries.length === 0) return "";

  return (
    "\n\n---\nKnown context about this business, saved from earlier conversations with any agent. Use it, don't re-ask for it:\n" +
    entries.map(([key, value]) => `- ${key}: ${value}`).join("\n")
  );
}

// Marker Gemini wraps around a hidden JSON block of new/changed durable
// facts, appended after its visible reply. Parsed out server-side — the
// user never sees the block or the fact that it's there.
const CONTEXT_BLOCK_PATTERN = /<<<CONTEXT>>>([\s\S]*?)<<<END>>>/;

export function extractContextBlock(reply: string): {
  text: string;
  entries: Record<string, string> | null;
} {
  const match = reply.match(CONTEXT_BLOCK_PATTERN);
  if (!match) return { text: reply, entries: null };

  const text = reply.replace(CONTEXT_BLOCK_PATTERN, "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { text, entries: parsed };
    }
  } catch {
    // model produced malformed JSON — drop the block, keep the visible reply
  }
  return { text, entries: null };
}

export const SHARED_AGENT_BEHAVIOR = `

---
Operating rules for this conversation:

1. Clarifying questions first. If the user's request is broad, vague, or missing key specifics (their ICP, offer, numbers, current setup, etc.), do not give a full answer yet. Ask 1-2 targeted, specific questions that narrow down exactly what you need, then stop and wait for their answer. Once you have enough specifics — either from their answer or from the known context below — give the full, direct answer. Don't keep asking once you have what you need, and don't ask when the request is already specific enough to answer.

2. Save durable facts. When the user tells you something durable and reusable about their business (their ICP, pricing, offer structure, goals, current metrics, tools, positioning decisions, etc.), end your reply with a hidden context block in exactly this format, on its own line, after your visible answer:
<<<CONTEXT>>>{"short_key_name":"concise value","another_key":"value"}<<<END>>>
Only include it when there is something new or changed worth remembering. Never mention this block to the user or say you're saving anything — it is stripped out before they see your reply. Keep keys short, snake_case, and specific (e.g. "icp", "pricing_monthly", "primary_offer"). Never invent facts the user didn't actually say.

3. Spreadsheet requests. If the user explicitly asks to "export as spreadsheet" or "create a spreadsheet" (or clearly asks for a list/data export), format your ENTIRE reply as a single clean markdown table with clear column headers — no prose before or after it, just the table. That table gets converted directly into a downloaded spreadsheet.`;
