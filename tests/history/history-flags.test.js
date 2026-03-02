const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseHistoryFlags } = requireDist("lib/history/flags.js");

test("parses skill id, limit, cursor, and json flag", () => {
  const parsed = parseHistoryFlags([
    "@stefdevscore/test-skill",
    "--limit",
    "10",
    "--cursor",
    "opaque",
    "--json",
  ]);

  assert.deepEqual(parsed, {
    skillId: "@stefdevscore/test-skill",
    limit: 10,
    cursor: "opaque",
    json: true,
    valid: true,
  });
});

test("parses cursor value that starts with hyphen", () => {
  const parsed = parseHistoryFlags(["owner/skill", "--cursor", "-abc123"]);

  assert.deepEqual(parsed, {
    skillId: "owner/skill",
    limit: undefined,
    cursor: "-abc123",
    json: false,
    valid: true,
  });
});

for (const args of [
  [],
  ["owner/skill", "extra"],
  ["owner/skill", "--limit", "0"],
  ["owner/skill", "--limit", "51"],
  ["owner/skill", "--limit", "x"],
  ["owner/skill", "--bad-flag"],
  ["owner/skill", "--cursor"],
  ["owner/skill", "--cursor", "--json"],
]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parseHistoryFlags(args);
    assert.equal(parsed.valid, false);
  });
}
