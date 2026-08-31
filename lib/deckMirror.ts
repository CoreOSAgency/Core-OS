// A lightweight HTML twin of the deck, built from the same DeckModel the real
// .pptx renders from. Headless Chrome screenshots each <section> and a vision
// model checks the shots for overflow / overlap / contrast. Not shipped to the
// user - QA only.

import { BOX, PX_PER_IN, SLIDE_W_IN, SLIDE_H_IN, type DeckModel } from "./deckModel";

const W = Math.round(SLIDE_W_IN * PX_PER_IN);
const H = Math.round(SLIDE_H_IN * PX_PER_IN);
const px = (inches: number) => Math.round(inches * PX_PER_IN);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function box(rect: { x: number; y: number; w: number; h: number }): string {
  return `position:absolute;left:${px(rect.x)}px;top:${px(rect.y)}px;width:${px(rect.w)}px;height:${px(rect.h)}px;`;
}

export function renderMirrorHtml(
  model: DeckModel,
  opts: { qaMarks?: boolean } = {},
): string {
  // qaMarks: dashed bounds + let text spill, so the vision QA pass can see
  // overflow. Off for any non-QA use.
  const bodyExtra = opts.qaMarks
    ? "overflow:visible;outline:1px dashed rgba(255,255,255,0.4);"
    : "overflow:hidden;";
  const sections: string[] = [];

  // Title slide (index 0 in the screenshot list; QaIssue.slide is 1-based over
  // the CONTENT slides, so it is offset by one - see deckQa).
  sections.push(`
    <section data-slide="title" style="width:${W}px;height:${H}px;position:relative;overflow:hidden;background:#${model.bg};">
      ${
        model.logo
          ? `<img src="${model.logo.dataUrl}" style="position:absolute;left:${px(BOX.logo.x)}px;top:${px(BOX.logo.y)}px;height:${px(model.logo.hIn)}px;width:${px(model.logo.wIn)}px;object-fit:contain;" />`
          : ""
      }
      <div style="${box(BOX.titleText)}color:#${model.text};font-size:${BOX.titleText.pt}px;font-weight:700;line-height:1.15;">${esc(model.title)}</div>
    </section>`);

  model.slides.forEach((slide, i) => {
    const bullets = slide.bullets
      .map((b) => `<li style="margin-bottom:10px;">${esc(b)}</li>`)
      .join("");
    sections.push(`
    <section data-slide="${i}" style="width:${W}px;height:${H}px;position:relative;overflow:hidden;background:#${model.bg};">
      <div style="${box(BOX.heading)}color:#${model.accent};font-size:${BOX.heading.pt}px;font-weight:700;line-height:1.1;">${esc(slide.heading)}</div>
      <ul style="position:absolute;left:${px(BOX.body.x)}px;top:${px(BOX.body.y)}px;width:${px(slide.bodyWidthIn)}px;height:${px(BOX.body.h)}px;margin:0;padding-left:22px;color:#${model.text};font-size:${slide.bodyFontPt}px;line-height:1.2;list-style:disc;${bodyExtra}">${bullets}</ul>
      ${
        slide.image
          ? `<img src="${slide.image.dataUrl}" style="position:absolute;left:${px(BOX.image.x)}px;top:${px(BOX.image.y)}px;width:${px(BOX.image.w * slide.image.scale)}px;height:${px(BOX.image.h * slide.image.scale)}px;object-fit:contain;" />`
          : ""
      }
    </section>`);
  });

  return `<!doctype html><html><head><meta charset="utf-8">
    <style>
      *{box-sizing:border-box;margin:0;}
      body{font-family:Arial,Helvetica,sans-serif;background:#000;}
      section{display:block;}
    </style></head><body>${sections.join("")}</body></html>`;
}
