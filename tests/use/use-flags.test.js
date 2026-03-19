const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseUseFlags } = requireDist("lib/use/flags.js");

test("parses skill id with default selector behavior", () => {
  const parsed = parseUseFlags(["test-skill"]);

  assert.deepEqual(parsed, {
    skillId: "test-skill",
    version: undefined,
    spec: undefined,
    agentTarget: undefined,
    json: false,
    save: false,
    global: false,
    valid: true,
  });
});

test("parses version selector with json flag", () => {
  const parsed = parseUseFlags(["@acme/skill", "--version", "1.2.3", "--json"]);

  assert.deepEqual(parsed, {
    skillId: "@acme/skill",
    version: "1.2.3",
    spec: undefined,
    agentTarget: undefined,
    json: true,
    save: false,
    global: false,
    valid: true,
  });
});

test("parses spec selector in equals form", () => {
  const parsed = parseUseFlags(["@acme/skill", "--spec=beta"]);

  assert.deepEqual(parsed, {
    skillId: "@acme/skill",
    version: undefined,
    spec: "beta",
    agentTarget: undefined,
    json: false,
    save: false,
    global: false,
    valid: true,
  });
});

test("parses agent target", () => {
  const parsed = parseUseFlags(["test-skill", "--agent-target", "custom:myagent"]);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.agentTarget, "custom:myagent");
});

test("parses new builtin agent target", () => {
  const parsed = parseUseFlags(["test-skill", "--agent-target", "perplexity"]);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.agentTarget, "perplexity");
});

for (const args of [
  [],
  ["test-skill", "--version"],
  ["test-skill", "--version", "x"],
  ["test-skill", "--spec"],
  ["test-skill", "--agent-target", "custom:UPPER"],
  ["test-skill", "--version", "1.2.3", "--spec", "latest"],
  ["test-skill", "--unknown"],
]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parseUseFlags(args);
    assert.equal(parsed.valid, false);
  });
}
