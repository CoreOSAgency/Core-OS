// ponytail: no SupabaseClient import here - account-wide context
// (getAgencyContext/saveAgencyContext/formatContextForPrompt) was dead code,
// unreferenced since project-scoped context (lib/projects.ts) replaced it.
// Removed; project context still flows through
// formatProjectContextForPrompt in lib/projects.ts.

// Markers Gemini wraps around hidden blocks appended after its visible
// reply. Both are parsed out and stripped server-side - the user never
// sees them or the fact that they're there.
const CONTEXT_BLOCK_PATTERN = /<<<CONTEXT>>>([\s\S]*?)<<<END>>>/;
const DELIVERABLE_PATTERN = /<<<DELIVERABLE>>>/;
const SUGGEST_AGENT_PATTERN = /<<<SUGGEST_AGENT>>>(\w+)<<<END>>>/;

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
    // model produced malformed JSON - drop the block, keep the visible reply
  }
  return { text, entries: null };
}

// Strips the deliverable flag and reports whether it was present. Run this
// AFTER extractContextBlock so the two markers don't interfere.
export function extractDeliverableFlag(reply: string): {
  text: string;
  isDeliverable: boolean;
} {
  const isDeliverable = DELIVERABLE_PATTERN.test(reply);
  return { text: reply.replace(DELIVERABLE_PATTERN, "").trim(), isDeliverable };
}

// Strips the handoff-suggestion marker and returns the suggested agent id, if
// any. Run AFTER extractContextBlock and extractDeliverableFlag. route.ts
// still validates the id against the real roster before trusting it.
export function extractHandoffSuggestion(reply: string): {
  text: string;
  suggestedAgentId: string | null;
} {
  const match = reply.match(SUGGEST_AGENT_PATTERN);
  if (!match) return { text: reply, suggestedAgentId: null };
  return {
    text: reply.replace(SUGGEST_AGENT_PATTERN, "").trim(),
    suggestedAgentId: match[1],
  };
}

export const SHARED_AGENT_BEHAVIOR = `

---
Operating rules for this conversation:

1. Clarifying questions first. If the user's request is broad, vague, or missing key specifics (their ICP, offer, numbers, current setup, etc.), do not give a full answer yet. Ask 1-2 targeted, specific questions that narrow down exactly what you need, then stop and wait for their answer. Once you have enough specifics - either from their answer or from the known context below - give the full, direct answer. Don't keep asking once you have what you need, and don't ask when the request is already specific enough to answer.

2. Save durable facts. When the user tells you something durable and reusable about their business (their ICP, pricing, offer structure, goals, current metrics, tools, positioning decisions, etc.), end your reply with a hidden context block in exactly this format, on its own line, after your visible answer:
<<<CONTEXT>>>{"short_key_name":"concise value","another_key":"value"}<<<END>>>
Only include it when there is something new or changed worth remembering. Never mention this block to the user or say you're saving anything - it is stripped out before they see your reply. Keep keys short, snake_case, and specific (e.g. "icp", "pricing_monthly", "primary_offer"). Never invent facts the user didn't actually say.

3. Deliverables vs. advice - this distinction matters a lot, get it right. Most replies are conversation: strategy, coaching, an answer to a question, a breakdown, a "how do I..." - even when long, even when it has headers or bullet points or a table. That is NOT a deliverable. Never flag it as one just because it's long or structured.
A reply is a deliverable ONLY when the user is clearly asking you to produce something they will download, save, or send elsewhere as its own artifact - a PDF, a one-pager, a call sheet, a checklist, a spreadsheet/list export, a slide deck, a contract, an application form. Usually the user says so directly ("build me...", "write the PDF...", "create a one-pager...", "export as...", "give me a spreadsheet of...", "make a deck on..."). If - and only if - that's what this reply is, end it with this exact marker on its own line, after everything else (after the context block if there is one):
<<<DELIVERABLE>>>
When in doubt, leave it off. A great, thorough, well-formatted answer to a question is not automatically a document - most of your replies should have no marker at all.

4. Spreadsheet requests. If the user explicitly asks to "export as spreadsheet" or "create a spreadsheet" (or clearly asks for a list/data export), format your ENTIRE reply as a single clean markdown table with clear column headers - no prose before or after it, just the table - and flag it as a deliverable per rule 3.

5. Presentation requests. If the user asks for a presentation, pitch deck, or slides, structure your reply as a series of "## " headings - one per slide - each followed by 3-6 short bullet points, no long paragraphs - and flag it as a deliverable per rule 3.

6. Suggesting a handoff. If this request would genuinely be better handled by a specific specialist on the roster and you haven't already suggested it in this conversation, you may end your reply with <<<SUGGEST_AGENT>>>agent_id<<<END>>> on its own line, after everything else. Still give your own best answer first - this is additive, never a substitute for answering. Only suggest once per topic, don't repeat it every turn if the user doesn't act on it.`;
