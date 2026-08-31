import PptxGenJS from "pptxgenjs";
import type { Slide } from "./markdownToBlocks";
import {
  buildDeckModel,
  BOX,
  DECK_FONT_STACK,
  SLIDE_W_IN,
  SLIDE_H_IN,
  fitBodyFontSize,
  type DeckModel,
  type SlideImage,
} from "./deckModel";

// Re-exported so existing importers (routes, tests) don't need to change.
export { fitBodyFontSize };
export type { SlideImage };

const FONT = DECK_FONT_STACK.split(",")[0].trim(); // "Arial" for pptxgenjs

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

export async function generatePptx(input: PresentationInput): Promise<Buffer> {
  const model = await buildDeckModel(input);
  return renderPptxFromModel(model);
}

// Renders the real .pptx from an already-resolved model. The QA path builds
// the model, screenshots an HTML mirror of the same model, optionally adjusts
// it, then calls this - so what ships is exactly what was QA'd.
export async function renderPptxFromModel(model: DeckModel): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "DECK_16x9", width: SLIDE_W_IN, height: SLIDE_H_IN });
  pres.layout = "DECK_16x9";

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: model.bg };
  if (model.logo) {
    titleSlide.addImage({
      data: model.logo.dataUrl,
      x: BOX.logo.x, y: BOX.logo.y, w: model.logo.wIn, h: model.logo.hIn,
    });
  }
  titleSlide.addText(model.title, {
    x: BOX.titleText.x, y: BOX.titleText.y, w: BOX.titleText.w, h: BOX.titleText.h,
    color: model.text, fontFace: FONT, fontSize: BOX.titleText.pt, bold: true,
  });

  for (const slide of model.slides) {
    const s = pres.addSlide();
    s.background = { color: model.bg };

    s.addText(slide.heading, {
      x: BOX.heading.x, y: BOX.heading.y, w: BOX.heading.w, h: BOX.heading.h,
      color: model.accent, fontFace: FONT, fontSize: BOX.heading.pt, bold: true,
    });

    if (slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
        {
          x: BOX.body.x, y: BOX.body.y, w: slide.bodyWidthIn, h: BOX.body.h,
          color: model.text, fontFace: FONT, fontSize: slide.bodyFontPt,
          valign: "top", paraSpaceAfter: 10,
        },
      );
    }

    if (slide.image) {
      const w = BOX.image.w * slide.image.scale;
      const h = BOX.image.h * slide.image.scale;
      s.addImage({
        data: slide.image.dataUrl,
        x: BOX.image.x, y: BOX.image.y, w, h,
        sizing: { type: "contain", w, h },
      });
    }
  }

  const buffer = await pres.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
