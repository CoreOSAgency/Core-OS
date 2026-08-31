// Run: npx tsx lib/deckModel.test.ts
import assert from "node:assert";
import { buildDeckModel, applyQaFixes, fitBodyFontSize, type QaIssue } from "./deckModel";
import { parseQaIssues, qaNotesSentence } from "./deckQa";

// --- fitBodyFontSize ---
assert.equal(fitBodyFontSize([], 5, 3.7), 16);
assert.equal(fitBodyFontSize(["a", "b", "c"], 8.8, 3.7), 16);
const dense = Array.from({ length: 6 }, () =>
  "This is a deliberately long bullet that wraps across several lines and eats vertical space"
);
assert.ok(fitBodyFontSize(dense, 5.0, 3.7) < 16, "dense slide should shrink");

// --- buildDeckModel: no brand, one image ---
(async () => {
  const model = await buildDeckModel({
    title: "Q3 Plan",
    slides: [
      { heading: "Intro", bullets: ["short"] },
      { heading: "Data", bullets: dense },
    ],
    slideImages: [{ slideIndex: 1, base64: "AAAA", mime: "image/png" }],
  });
  assert.equal(model.slides.length, 2);
  assert.equal(model.bg, "1A1A1A");
  assert.equal(model.accent, "9AA0A6");
  assert.ok(model.slides[0].image, "slide 1 has an image");
  assert.equal(model.slides[0].bodyWidthIn, 5.0, "image slide uses split width");
  assert.equal(model.slides[1].bodyWidthIn, 8.8, "text-only slide uses full width");
  assert.equal(model.slides[0].image!.dataUrl.slice(0, 22), "data:image/png;base64,");

  // No explicit background -> branded gradient, not flat grey.
  assert.equal(model.bg, "1A1A1A");
  assert.ok(model.bgCss.startsWith("radial-gradient("), "default bg is a gradient");
  assert.ok(model.bgCss.includes("#0b0c0e"), "gradient bottoms out near-black");

  // Explicit background_color -> flat fill.
  const solid = await buildDeckModel({
    title: "T",
    slides: [{ heading: "H", bullets: ["x"] }],
    backgroundColor: "#123456",
  });
  assert.equal(solid.bgCss, "#123456");

  // The model is stored as jsonb - it must round-trip losslessly.
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);

  // --- applyQaFixes: overflow steps the font down, once ---
  const issues: QaIssue[] = [{ slide: 2, issue: "overflow", detail: "text past box" }];
  const before = model.slides[1].bodyFontPt;
  const r1 = applyQaFixes(model, issues);
  assert.equal(r1.changed, true);
  assert.ok(r1.model.slides[1].bodyFontPt < before, "font stepped down");
  assert.equal(r1.model.slides[0].bodyFontPt, model.slides[0].bodyFontPt, "other slides untouched");

  // floor: keep applying until it can't go lower, then changed=false
  let m = r1.model;
  for (let i = 0; i < 10; i++) m = applyQaFixes(m, issues).model;
  assert.equal(applyQaFixes(m, issues).changed, false, "stops at the floor");

  // overlap shrinks the image
  const r2 = applyQaFixes(model, [{ slide: 1, issue: "overlap", detail: "img over text" }]);
  assert.equal(r2.changed, true);
  assert.ok(r2.model.slides[0].image!.scale < 1);

  console.log("deckModel self-check passed");
})();

// --- parseQaIssues ---
assert.deepEqual(parseQaIssues("[]"), []);
assert.deepEqual(
  parseQaIssues('noise before [{"slide":3,"issue":"overflow","detail":"long"}] after'),
  [{ slide: 3, issue: "overflow", detail: "long" }],
);
assert.deepEqual(parseQaIssues('[{"slide":0,"issue":"overflow"},{"slide":2,"issue":"bogus"}]'), []);
assert.deepEqual(parseQaIssues("not json at all"), []);
assert.equal(qaNotesSentence([]), "");
assert.ok(qaNotesSentence([{ slide: 3, issue: "overflow", detail: "" }]).includes("slide 3"));
assert.ok(!qaNotesSentence([{ slide: 3, issue: "overflow", detail: "" }]).includes("—"), "no em dash");
