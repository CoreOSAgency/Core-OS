// Run: npx tsx lib/agencyContext.test.ts
import assert from "node:assert";
import { extractHandoffSuggestion, extractContextBlock } from "./agencyContext";

// handoff marker is stripped and the id returned
{
  const r = extractHandoffSuggestion("Here is my answer.\n<<<SUGGEST_AGENT>>>juno<<<END>>>");
  assert.equal(r.suggestedAgentId, "juno");
  assert.equal(r.text, "Here is my answer.");
}
// no marker -> null, text unchanged
{
  const r = extractHandoffSuggestion("Just a normal reply.");
  assert.equal(r.suggestedAgentId, null);
  assert.equal(r.text, "Just a normal reply.");
}
// context block still parses (regression guard for the shared marker family)
{
  const r = extractContextBlock('Answer.\n<<<CONTEXT>>>{"icp":"agencies"}<<<END>>>');
  assert.deepEqual(r.entries, { icp: "agencies" });
}

console.log("agencyContext self-check passed");
