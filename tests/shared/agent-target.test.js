const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { normalizeAgentTarget, resolveDefaultAgentTarget, parseCustomAgentSlug } = requireDist(
  "lib/shared/agent-target.js",
);

test("normalizeAgentTarget accepts builtin and custom targets", () => {
  assert.equal(normalizeAgentTarget("skillmd"), "skillmd");
  assert.equal(normalizeAgentTarget("CLAUDE"), "claude");
  assert.equal(normalizeAgentTarget("custom:my-agent"), "custom:my-agent");
});

test("normalizeAgentTarget rejects malformed targets", () => {
  assert.equal(normalizeAgentTarget("custom:UPPER"), null);
  assert.equal(normalizeAgentTarget("custom:"), null);
  assert.equal(normalizeAgentTarget("unknown"), null);
});

test("resolveDefaultAgentTarget falls back to skillmd", () => {
  assert.equal(resolveDefaultAgentTarget(undefined), "skillmd");
  assert.equal(resolveDefaultAgentTarget(""), "skillmd");
});

test("resolveDefaultAgentTarget throws for invalid env value", () => {
  assert.throws(() => resolveDefaultAgentTarget("custom:UPPER"), /invalid SKILLMD_AGENT_TARGET/i);
});

test("parseCustomAgentSlug extracts slug for custom target", () => {
  assert.equal(parseCustomAgentSlug("custom:my-agent"), "my-agent");
  assert.equal(parseCustomAgentSlug("skillmd"), undefined);
});
