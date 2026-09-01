// Run: npx tsx lib/modelRouter.test.ts
import assert from "node:assert";
import { getModelConfig, extractGroundingSources } from "./modelRouter";

assert.equal(getModelConfig("deep").model, "gemini-3.1-pro-preview");
assert.equal(getModelConfig("quick").tools.length, 0);
// standard + deep carry search grounding + url_context (billing is on)
assert.deepEqual(
  getModelConfig("standard").tools.map((t) => t.type).sort(),
  ["google_search", "url_context"],
);
assert.deepEqual(
  getModelConfig("deep").tools.map((t) => t.type).sort(),
  ["google_search", "url_context"],
);
// unknown mode falls back to standard
assert.equal(getModelConfig("bogus" as never).model, "gemini-3.6-flash");

const grounded = extractGroundingSources({
  candidates: [
    {
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: "x", title: "X" } },
          { web: { uri: "x", title: "dup" } },
          { web: { title: "no uri" } },
        ],
      },
    },
  ],
});
assert.deepEqual(grounded, [{ title: "X", url: "x" }]);
assert.deepEqual(extractGroundingSources({}), []);
assert.deepEqual(extractGroundingSources(null), []);

console.log("modelRouter self-check passed");
