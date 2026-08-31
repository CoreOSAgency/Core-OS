// Run: npx tsx lib/presentationGenerator.test.ts
import assert from "node:assert";
import { fitBodyFontSize } from "./presentationGenerator";

// Empty -> largest step, no work.
assert.equal(fitBodyFontSize([], 5, 3.7), 16);

// A few short bullets fit at full size.
assert.equal(fitBodyFontSize(["Point one", "Point two", "Point three"], 8.8, 3.7), 16);

// A wall of text in the narrow two-column box gets stepped down.
const dense = Array.from({ length: 6 }, () =>
  "This is a deliberately long bullet that wraps across several lines and eats vertical space in the box"
);
assert.ok(fitBodyFontSize(dense, 5.0, 3.7) < 16, "dense slide should shrink");

// Never goes below the floor even when hopeless.
const hopeless = Array.from({ length: 30 }, () => "x".repeat(400));
assert.equal(fitBodyFontSize(hopeless, 5.0, 3.7), 12);

console.log("presentationGenerator self-check passed");
