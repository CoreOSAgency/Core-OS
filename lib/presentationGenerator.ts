import PptxGenJS from "pptxgenjs";
import type { Slide } from "./markdownToBlocks";
import { fetchImageForExport, normalizeHex } from "./imageForExport";

// Neutral, brand-free defaults for a client-facing deck. The client's real
// logo, accent colour, and background are layered on top when the project
// has a brand kit set - CoreOS's own identity is never the default.
const BG_DEFAULT = "1A1A1A";
const TEXT = "F5F5F5";
const NEUTRAL_ACCENT = "9AA0A6";
const FONT = "Arial";

// A per-slide generated image, keyed to the slide by 1-indexed position.
export type SlideImage = { slideIndex: number; base64: string; mime: string };

const BODY_FONT_STEPS = [16, 14, 12] as const;

// Rough characters-per-line x line-count estimate against the text box, so a
// dense slide gets its body font stepped down before it ships instead of
// spilling past the box edge. Deliberately approximate (Arial ~0.5em average
// advance, 1.2 line height) - it only needs to catch the bad cases, not lay
// out pixels. Returns the largest step that fits, or the smallest step if
// nothing does.
// ponytail: heuristic fit check; a real headless render (Phase 12 step 2)
// replaces this if the estimate proves too loose in practice.
export function fitBodyFontSize(
  bullets: string[],
  boxWidthInches: number,
  boxHeightInches: number,
): number {
  if (bullets.length === 0) return BODY_FONT_STEPS[0];
  const widthPt = boxWidthInches * 72;
  const boxHeightPt = boxHeightInches * 72;
  const paraSpaceAfterPt = 10; // matches the addText call below

  for (const size of BODY_FONT_STEPS) {
    const charsPerLine = Math.max(1, Math.floor(widthPt / (size * 0.5)));
    const lineHeightPt = size * 1.2;
    let usedPt = 0;
    for (const text of bullets) {
      const lines = Math.max(1, Math.ceil((text.length + 2) / charsPerLine));
      usedPt += lines * lineHeightPt + paraSpaceAfterPt;
    }
    if (usedPt <= boxHeightPt) return size;
  }
  return BODY_FONT_STEPS[BODY_FONT_STEPS.length - 1];
}

export type PresentationInput = {
  title: string;
  slides: Slide[];
  projectName?: string;
  agentName?: string;
  logoUrl?: string;
  accentColor?: string;
  backgroundColor?: string;
  slideImages?: SlideImage[];
};

export async function generatePptx({
  title,
  slides,
  logoUrl,
  accentColor,
  backgroundColor,
  slideImages = [],
}: PresentationInput): Promise<Buffer> {
  const accent = normalizeHex(accentColor) ?? NEUTRAL_ACCENT;
  const bg = normalizeHex(backgroundColor) ?? BG_DEFAULT;
  const logo = logoUrl ? await fetchImageForExport(logoUrl) : null;
  const imageBySlide = new Map(slideImages.map((im) => [im.slideIndex, im]));

  const pres = new PptxGenJS();
  pres.defineLayout({ name: "DECK_16x9", width: 10, height: 5.63 });
  pres.layout = "DECK_16x9";

  // Title slide
  const title_slide = pres.addSlide();
  title_slide.background = { color: bg };
  if (logo) {
    const h = 0.55;
    const w = Math.min(3, (h * logo.width) / logo.height);
    title_slide.addImage({ data: `data:${logo.mime};base64,${logo.base64}`, x: 0.6, y: 0.45, w, h });
  }
  title_slide.addText(title, {
    x: 0.6, y: 2.0, w: 8.8, h: 1.4,
    color: TEXT, fontFace: FONT, fontSize: 36, bold: true,
  });

  slides.forEach((slide, i) => {
    const s = pres.addSlide();
    s.background = { color: bg };
    const img = imageBySlide.get(i + 1);
    // Two columns when a slide has an image; full width otherwise.
    const textW = img ? 5.0 : 8.8;

    s.addText(slide.heading, {
      x: 0.6, y: 0.45, w: 8.8, h: 0.8,
      color: accent, fontFace: FONT, fontSize: 26, bold: true,
    });
    if (slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
        {
          x: 0.6, y: 1.5, w: textW, h: 3.7,
          color: TEXT, fontFace: FONT,
          fontSize: fitBodyFontSize(slide.bullets, textW, 3.7),
          valign: "top", paraSpaceAfter: 10,
        }
      );
    }
    if (img) {
      s.addImage({
        data: `data:${img.mime};base64,${img.base64}`,
        x: 5.9, y: 1.4, w: 3.5, h: 3.6,
        sizing: { type: "contain", w: 3.5, h: 3.6 },
      });
    }
  });

  const buffer = await pres.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
