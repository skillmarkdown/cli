const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseUseFlags } = requireDist("lib/use/flags.js");

test("parses skill id with default selector behavior", () => {
  const parsed = parseUseFlags(["@stefdevscore/test-skill"]);

  assert.deepEqual(parsed, {
    skillId: "@stefdevscore/test-skill",
    version: undefined,
    spec: undefined,
    agentTarget: undefined,
    json: false,
    save: false,
    valid: true,
  });
});

test("parses version selector with json flag", () => {
  const parsed = parseUseFlags(["owner/skill", "--version", "1.2.3", "--json"]);

  assert.deepEqual(parsed, {
    skillId: "owner/skill",
    version: "1.2.3",
    spec: undefined,
    agentTarget: undefined,
    json: true,
    save: false,
    valid: true,
  });
});

test("parses spec selector in equals form", () => {
  const parsed = parseUseFlags(["owner/skill", "--spec=beta"]);

  assert.deepEqual(parsed, {
    skillId: "owner/skill",
    version: undefined,
    spec: "beta",
    agentTarget: undefined,
    json: false,
    save: false,
    valid: true,
  });
});

test("parses agent target", () => {
  const parsed = parseUseFlags(["owner/skill", "--agent-target", "custom:myagent"]);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.agentTarget, "custom:myagent");
});

for (const args of [
  [],
  ["owner/skill", "--version"],
  ["owner/skill", "--version", "x"],
  ["owner/skill", "--spec"],
  ["owner/skill", "--agent-target", "custom:UPPER"],
  ["owner/skill", "--version", "1.2.3", "--spec", "latest"],
  ["owner/skill", "--unknown"],
]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parseUseFlags(args);
    assert.equal(parsed.valid, false);
  });
}
