import PptxGenJS from "pptxgenjs";
import type { Slide } from "./markdownToBlocks";

// CoreOS dark theme for exported decks: near-black background, purple
// accent for headings, white body text.
const BG = "091209"; // sunbird deep green-black (core-main)
const ACCENT = "7C4DFF"; // core-purple — iridescent blue-violet
const TEXT = "F5F5F5";
const MUTED = "A3A3A3";
const FONT = "Arial";

export type PresentationInput = {
  title: string;
  slides: Slide[];
  projectName?: string;
  agentName?: string;
};

export async function generatePptx({
  title,
  slides,
  projectName,
  agentName,
}: PresentationInput): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "CORE_OS_16x9", width: 10, height: 5.63 });
  pres.layout = "CORE_OS_16x9";

  // Title slide
  const title_slide = pres.addSlide();
  title_slide.background = { color: BG };
  title_slide.addText("CoreOS", {
    x: 0.6, y: 0.5, w: 8.8, h: 0.4,
    color: ACCENT, fontFace: FONT, fontSize: 14, bold: true,
  });
  title_slide.addText(title, {
    x: 0.6, y: 2.0, w: 8.8, h: 1.4,
    color: TEXT, fontFace: FONT, fontSize: 36, bold: true,
  });
  const subtitle = [agentName && `by ${agentName}`, projectName].filter(Boolean).join(" — ");
  if (subtitle) {
    title_slide.addText(subtitle, {
      x: 0.6, y: 3.4, w: 8.8, h: 0.5,
      color: MUTED, fontFace: FONT, fontSize: 16,
    });
  }

  for (const slide of slides) {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addText(slide.heading, {
      x: 0.6, y: 0.45, w: 8.8, h: 0.8,
      color: ACCENT, fontFace: FONT, fontSize: 26, bold: true,
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
