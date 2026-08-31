import PptxGenJS from "pptxgenjs";
import type { Slide } from "./markdownToBlocks";
import { fetchImageForExport, normalizeHex } from "./imageForExport";

// Neutral, brand-free defaults for a client-facing deck. The client's real
// logo and accent colour are layered on top when the project has a brand kit
// set - CoreOS's own identity is never the default.
const BG = "1A1A1A";
const TEXT = "F5F5F5";
const NEUTRAL_ACCENT = "9AA0A6";
const FONT = "Arial";

export type PresentationInput = {
  title: string;
  slides: Slide[];
  projectName?: string;
  agentName?: string;
  logoUrl?: string;
  accentColor?: string;
};

export async function generatePptx({
  title,
  slides,
  logoUrl,
  accentColor,
}: PresentationInput): Promise<Buffer> {
  const accent = normalizeHex(accentColor) ?? NEUTRAL_ACCENT;
  const logo = logoUrl ? await fetchImageForExport(logoUrl) : null;

  const pres = new PptxGenJS();
  pres.defineLayout({ name: "DECK_16x9", width: 10, height: 5.63 });
  pres.layout = "DECK_16x9";

  // Title slide
  const title_slide = pres.addSlide();
  title_slide.background = { color: BG };
  if (logo) {
    const h = 0.55;
    const w = Math.min(3, (h * logo.width) / logo.height);
    title_slide.addImage({
      data: `data:${logo.mime};base64,${logo.base64}`,
      x: 0.6,
      y: 0.45,
      w,
      h,
    });
  }
  title_slide.addText(title, {
    x: 0.6, y: 2.0, w: 8.8, h: 1.4,
    color: TEXT, fontFace: FONT, fontSize: 36, bold: true,
  });

  for (const slide of slides) {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addText(slide.heading, {
      x: 0.6, y: 0.45, w: 8.8, h: 0.8,
      color: accent, fontFace: FONT, fontSize: 26, bold: true,
    });
    if (slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
        {
          x: 0.6, y: 1.5, w: 8.8, h: 3.7,
          color: TEXT, fontFace: FONT, fontSize: 16, valign: "top",
          paraSpaceAfter: 10,
        }
      );
    }
  }

  const buffer = await pres.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
