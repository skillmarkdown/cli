const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseUpdateFlags } = requireDist("lib/update/flags.js");

test("parses no-arg update as valid", () => {
  const parsed = parseUpdateFlags([]);

  assert.deepEqual(parsed, {
    all: false,
    json: false,
    global: false,
    skillIds: [],
    agentTarget: undefined,
    valid: true,
  });
});

test("parses --all with flags", () => {
  const parsed = parseUpdateFlags(["--all", "--json"]);

  assert.deepEqual(parsed, {
    all: true,
    json: true,
    global: false,
    skillIds: [],
    agentTarget: undefined,
    valid: true,
  });
});

test("parses multiple skill ids", () => {
  const parsed = parseUpdateFlags(["skill-a", "username/skill-b"]);

  assert.deepEqual(parsed, {
    all: false,
    json: false,
    global: false,
    skillIds: ["skill-a", "username/skill-b"],
    agentTarget: undefined,
    valid: true,
  });
});

test("parses --agent-target", () => {
  const parsed = parseUpdateFlags(["--all", "--agent-target", "claude"]);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.agentTarget, "claude");
});

for (const args of [["--all", "skill"], ["--bad-flag"], ["--agent-target", "custom:UPPER"]]) {
  test(`rejects invalid args: ${args.join(" ")}`, () => {
    const parsed = parseUpdateFlags(args);
    assert.equal(parsed.valid, false);
  });
}
