// Central mode -> Gemini request config. Nothing else should hardcode a
// model string; import getModelConfig from here.
//
// ponytail: two things are gated behind Gemini billing, which is OFF on Kurt's
// key (verified live 2026-08-31):
//   1. Pro — `gemini-3.1-pro` (only `-preview` is listed) returns 429 `limit: 0`,
//      so `deep` requests fall back to gemini-3.6-flash in practice.
//   2. Google Search grounding — ANY request carrying the `google_search` tool
//      429s on the free tier, even a trivial one. So `tools` is [] on every mode
//      for now. The grounding code path (extractGroundingSources, the Sources UI,
//      the grounding_sources column) all stay wired — re-add the tool entries
//      below once the key has billing and it lights up end to end.

export type ChatMode = "quick" | "standard" | "deep";

export interface ModelConfig {
  model: string;
  thinkingLevel: "minimal" | "low" | "medium" | "high";
  tools: Array<{ type: "google_search" | "url_context" }>;
  maxOutputTokens: number;
  fallbackModel: string;
}

const MODEL_CONFIG: Record<ChatMode, ModelConfig> = {
  quick: {
    model: "gemini-3.5-flash-lite",
    thinkingLevel: "minimal",
    tools: [],
    maxOutputTokens: 1024,
    fallbackModel: "gemini-3.6-flash",
  },
  standard: {
    model: "gemini-3.6-flash",
    thinkingLevel: "medium",
    tools: [], // billing-gated: [{ type: "google_search" }]
    maxOutputTokens: 4096,
    fallbackModel: "gemini-3.5-flash-lite",
  },
  deep: {
    model: "gemini-3.1-pro-preview",
    thinkingLevel: "high",
    tools: [], // billing-gated: [{ type: "google_search" }, { type: "url_context" }]
    maxOutputTokens: 8192,
    fallbackModel: "gemini-3.6-flash",
  },
};

export function getModelConfig(mode: ChatMode): ModelConfig {
  return MODEL_CONFIG[mode] ?? MODEL_CONFIG.standard;
}

// Pulls citation sources out of a Gemini generateContent response's
// groundingMetadata. Returns [] for any missing/malformed shape — never throws.
export function extractGroundingSources(
  geminiJson: unknown
): Array<{ title: string; url: string }> {
  const candidate = (
    geminiJson as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: unknown } }> }
  )?.candidates?.[0];
  const chunks = candidate?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set<string>();
  const sources: Array<{ title: string; url: string }> = [];
  for (const chunk of chunks) {
    const url: unknown = chunk?.web?.uri;
    if (typeof url !== "string" || !url || seen.has(url)) continue;
    seen.add(url);
    const title = chunk?.web?.title;
    sources.push({ title: typeof title === "string" && title ? title : url, url });
  }
  return sources;
}
