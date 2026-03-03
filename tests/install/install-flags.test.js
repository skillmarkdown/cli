const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseInstallFlags } = requireDist("lib/install/flags.js");

test("parses default install flags", () => {
  const parsed = parseInstallFlags([]);
  assert.deepEqual(parsed, {
    prune: false,
    json: false,
    agentTarget: undefined,
    valid: true,
  });
});

test("parses prune/json/agent-target flags", () => {
  const parsed = parseInstallFlags(["--prune", "--json", "--agent-target", "claude"]);
  assert.deepEqual(parsed, {
    prune: true,
    json: true,
    agentTarget: "claude",
    valid: true,
  });
});

for (const args of [
  ["--bad"],
  ["--agent-target"],
  ["--agent-target", "custom:UPPER"],
  ["@owner/skill"],
]) {
  test(`rejects invalid args: ${args.join(" ")}`, () => {
    const parsed = parseInstallFlags(args);
    assert.equal(parsed.valid, false);
  });
}
