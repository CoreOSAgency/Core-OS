// Central mode -> Gemini request config. Nothing else should hardcode a
// model string; import getModelConfig from here.
//
// Gemini billing is ON as of 2026-09-01, so google_search grounding +
// url_context are enabled on standard and deep. quick stays tool-free to keep
// it fast. `deep` still uses gemini-3.1-pro-preview; if that 429s it falls back
// to gemini-3.6-flash via fallbackModel.

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
    tools: [{ type: "google_search" }, { type: "url_context" }],
    maxOutputTokens: 4096,
    fallbackModel: "gemini-3.5-flash-lite",
  },
  deep: {
    model: "gemini-3.1-pro-preview",
    thinkingLevel: "high",
    tools: [{ type: "google_search" }, { type: "url_context" }],
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
