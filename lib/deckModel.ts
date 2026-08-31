// The one resolved description of a deck. Both the real .pptx
// (presentationGenerator) and the HTML mirror used for visual QA (deckMirror)
// render from this - the box geometry, colours, font sizes and image
// placement live here once so the two can't drift apart.

import { fetchImageForExport, normalizeHex } from "./imageForExport";
import { parseMarkdownToSlides, type Slide } from "./markdownToBlocks";

export const SLIDE_W_IN = 10;
export const SLIDE_H_IN = 5.63;
export const PX_PER_IN = 96;

// All rects in inches, top-left origin - shared by both renderers.
export const BOX = {
  logo: { x: 0.6, y: 0.45, h: 0.55, maxW: 3 },
  titleText: { x: 0.6, y: 2.0, w: 8.8, h: 1.4, pt: 36 },
  heading: { x: 0.6, y: 0.45, w: 8.8, h: 0.8, pt: 26 },
  body: { x: 0.6, y: 1.5, wFull: 8.8, wSplit: 5.0, h: 3.7 },
  image: { x: 5.9, y: 1.4, w: 3.5, h: 3.6 },
} as const;

export const DECK_BG_DEFAULT = "1A1A1A";
export const DECK_TEXT = "F5F5F5";
export const DECK_NEUTRAL_ACCENT = "9AA0A6";
export const DECK_FONT_STACK = "Arial, Helvetica, sans-serif";

const BODY_FONT_STEPS = [16, 14, 12] as const;
const BODY_FONT_FLOOR = 10;

// Full step-down sequence (largest to smallest). The server picks a starting
// size from the estimate below; the live viewer re-fits against real measured
// DOM height using this same sequence.
export const BODY_FONT_SEQUENCE: readonly number[] = [16, 14, 12, 10];

// Rough characters-per-line x line-count estimate against the text box, so a
// dense slide gets its body font stepped down before it ships instead of
// spilling past the box edge. Deliberately approximate (Arial ~0.5em average
// advance, 1.2 line height) - it only needs to catch the bad cases.
// ponytail: heuristic; the headless render + vision QA (deckQa) is the
// backstop when the estimate is too loose.
export function fitBodyFontSize(
  bullets: string[],
  boxWidthInches: number,
  boxHeightInches: number,
): number {
  if (bullets.length === 0) return BODY_FONT_STEPS[0];
  for (const size of BODY_FONT_STEPS) {
    if (bulletsFit(bullets, boxWidthInches, boxHeightInches, size)) return size;
  }
  return BODY_FONT_STEPS[BODY_FONT_STEPS.length - 1];
}

function bulletsFit(
  bullets: string[],
  boxWidthInches: number,
  boxHeightInches: number,
  size: number,
): boolean {
  const widthPt = boxWidthInches * 72;
  const boxHeightPt = boxHeightInches * 72;
  const charsPerLine = Math.max(1, Math.floor(widthPt / (size * 0.5)));
  const lineHeightPt = size * 1.2;
  const paraSpaceAfterPt = 10;
  let usedPt = 0;
  for (const text of bullets) {
    const lines = Math.max(1, Math.ceil((text.length + 2) / charsPerLine));
    usedPt += lines * lineHeightPt + paraSpaceAfterPt;
  }
  return usedPt <= boxHeightPt;
}

// One generated image, keyed to a slide by 1-indexed position. Stored in the
// deck-assets bucket; url is its public URL.
export type SlideImage = { slideIndex: number; url: string };

export type DeckModelInput = {
  title: string;
  slides: Slide[];
  logoUrl?: string;
  accentColor?: string;
  backgroundColor?: string;
  slideImages?: SlideImage[];
};

export type ModelImage = { src: string; scale: number };

export type ContentSlideModel = {
  heading: string;
  bullets: string[];
  bodyFontPt: number;
  bodyWidthIn: number;
  image: ModelImage | null;
};

export type DeckModel = {
  title: string;
  bg: string; // solid hex, kept for the (idle) QA mirror
  bgCss: string; // what the live viewer / PDF actually paints
  accent: string;
  text: string;
  logo: { dataUrl: string; wIn: number; hIn: number } | null;
  slides: ContentSlideModel[];
};

function rgba(hex: string, a: number): string {
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// An explicit background_color wins as a flat fill. Otherwise the deck gets a
// near-black canvas with a soft glow of the brand accent in one corner - a
// branded surface instead of flat grey, without decorative stripes or rules
// (which read as AI-generated).
function deckBackground(explicitBg: string | null, accent: string): string {
  if (explicitBg) return `#${explicitBg}`;
  return `radial-gradient(1100px 640px at 12% -10%, ${rgba(accent, 0.16)}, ${rgba(accent, 0.04)} 38%, #0b0c0e 68%)`;
}

export async function buildDeckModel(input: DeckModelInput): Promise<DeckModel> {
  const accent = normalizeHex(input.accentColor) ?? DECK_NEUTRAL_ACCENT;
  const explicitBg = normalizeHex(input.backgroundColor);
  const bg = explicitBg ?? DECK_BG_DEFAULT;
  const bgCss = deckBackground(explicitBg, accent);
  const logoImg = input.logoUrl ? await fetchImageForExport(input.logoUrl) : null;
  const imageBySlide = new Map(
    (input.slideImages ?? []).map((im) => [im.slideIndex, im]),
  );

  const slides: ContentSlideModel[] = input.slides.map((slide, i) => {
    const im = imageBySlide.get(i + 1);
    const bodyWidthIn = im ? BOX.body.wSplit : BOX.body.wFull;
    return {
      heading: slide.heading,
      bullets: slide.bullets,
      bodyFontPt: fitBodyFontSize(slide.bullets, bodyWidthIn, BOX.body.h),
      bodyWidthIn,
      image: im ? { src: im.url, scale: 1 } : null,
    };
  });

  return {
    title: input.title,
    bg,
    bgCss,
    accent,
    text: DECK_TEXT,
    logo: logoImg
      ? {
          dataUrl: `data:${logoImg.mime};base64,${logoImg.base64}`,
          wIn: Math.min(BOX.logo.maxW, (BOX.logo.h * logoImg.width) / logoImg.height),
          hIn: BOX.logo.h,
        }
      : null,
    slides,
  };
}

export type QaIssue = {
  slide: number; // 1-based, matching the content slides (title slide excluded)
  issue: "overflow" | "overlap" | "contrast";
  detail: string;
};

// One deterministic, bounded adjustment per flagged slide. Overflow -> step the
// body font down; overlap -> shrink that slide's image. Returns changed:false
// when nothing could be adjusted (so the caller stops instead of looping).
export function applyQaFixes(
  model: DeckModel,
  issues: QaIssue[],
): { model: DeckModel; changed: boolean } {
  let changed = false;
  const slides = model.slides.map((s, i) => {
    const issue = issues.find((x) => x.slide === i + 1);
    if (!issue) return s;
    if (issue.issue === "overflow" && s.bodyFontPt > BODY_FONT_FLOOR) {
      changed = true;
      return { ...s, bodyFontPt: Math.max(BODY_FONT_FLOOR, s.bodyFontPt - 2) };
    }
    if (issue.issue === "overlap" && s.image && s.image.scale > 0.7) {
      changed = true;
      return { ...s, image: { ...s.image, scale: Math.max(0.7, s.image.scale - 0.15) } };
    }
    return s;
  });
  return { model: { ...model, slides }, changed };
}

// Convenience for callers that only have the markdown text.
export function slidesFromText(text: string): Slide[] {
  return parseMarkdownToSlides(text);
}
