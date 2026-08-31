// Headless visual QA for generated decks. Screenshots the HTML mirror
// (deckMirror) with serverless Chrome and asks a vision model to flag real
// rendering problems. Everything here fails LOUD to its caller, which catches
// and ships the deck anyway (fail-open, same as slide-image generation).

import { renderMirrorHtml } from "./deckMirror";
import { launchHeadlessBrowser } from "./headlessChrome";
import type { DeckModel, QaIssue } from "./deckModel";

const QA_MODEL = "gemini-3.6-flash";

const QA_SYSTEM =
  "You are a strict visual QA reviewer for presentation slides. You will be shown rendered slide images, numbered from 1. " +
  "A dashed rectangle marks each text area's intended bounds (the dashed line itself is a QA guide, not part of the design). " +
  "Report ONLY real, visible problems: " +
  '(a) "overflow" - body text extends past the bottom of its dashed box, runs off the bottom edge of the slide, or is visibly clipped; ' +
  '(b) "overlap" - text and an image or two elements visibly sit on top of each other; ' +
  '(c) "contrast" - text is too close in colour to its background to read. ' +
  "Ignore the dashed box if the text comfortably fits inside it. Do not report wording, style, or anything that looks fine. " +
  'Respond with ONLY a JSON array, one object per problem slide: [{"slide": <number>, "issue": "overflow"|"overlap"|"contrast", "detail": "<short reason>"}]. ' +
  "If every slide is clean, respond with exactly [].";

// Screenshot each CONTENT slide (the title slide is excluded from QA). Returns
// base64 PNGs indexed 0..n-1, i.e. shot[j] is slide j+1.
// ponytail: kept but no longer wired up - Phase 13's live viewer fits text
// against real measured DOM, which is what this path mostly existed to check.
export async function screenshotContentSlides(model: DeckModel): Promise<string[]> {
  const html = renderMirrorHtml(model, { qaMarks: true });
  const browser = await launchHeadlessBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 570, deviceScaleFactor: 1 });
    // Images are inline data: URLs, so "load" is enough - nothing over the wire.
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });

    const shots: string[] = [];
    for (let i = 0; i < model.slides.length; i++) {
      const el = await page.$(`[data-slide="${i}"]`);
      if (!el) {
        shots.push("");
        continue;
      }
      const b64 = (await el.screenshot({ encoding: "base64", type: "png" })) as string;
      shots.push(b64);
    }
    return shots;
  } finally {
    await browser.close();
  }
}

export async function reviewSlideShots(
  shots: string[],
  key: string,
): Promise<QaIssue[]> {
  return parseQaIssues(await rawReviewSlideShots(shots, key));
}

// Same call, raw model text - for the ?debug path only.
export async function rawReviewSlideShots(
  shots: string[],
  key: string,
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [];
  shots.forEach((data, i) => {
    if (!data) return;
    parts.push({ text: `Slide ${i + 1}:` });
    parts.push({ inline_data: { mime_type: "image/png", data } });
  });
  if (parts.length === 0) return "[]";
  parts.push({ text: "Return the JSON array now." });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${QA_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: QA_SYSTEM }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) throw new Error(`QA model ${res.status}`);
  const json = await res.json();
  return (
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""
  );
}

export function parseQaIssues(text: string): QaIssue[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: QaIssue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const slide = Number(o.slide);
    const issue = o.issue;
    if (!Number.isInteger(slide) || slide < 1) continue;
    if (issue !== "overflow" && issue !== "overlap" && issue !== "contrast") continue;
    out.push({ slide, issue, detail: typeof o.detail === "string" ? o.detail : "" });
  }
  return out;
}

// One-line, user-facing summary of what is still off after the one retry.
export function qaNotesSentence(issues: QaIssue[]): string {
  if (issues.length === 0) return "";
  const parts = issues.map((x) => {
    const what =
      x.issue === "overflow" ? "text ran long" : x.issue === "overlap" ? "elements overlap" : "low contrast";
    return `slide ${x.slide} (${what})`;
  });
  return `Deck downloaded, but the visual check still flags ${parts.join(", ")} - you may want to trim or adjust those.`;
}
