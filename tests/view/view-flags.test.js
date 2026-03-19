const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseViewFlags } = requireDist("lib/view/flags.js");

test("parses skill id with --json", () => {
  const parsed = parseViewFlags(["@acme/test-skill", "--json"]);

  assert.deepEqual(parsed, {
    skillId: "@acme/test-skill",
    json: true,
    valid: true,
  });
});

test("parses numeric index for search row lookup", () => {
  const parsed = parseViewFlags(["1"]);

  assert.deepEqual(parsed, {
    skillId: "1",
    json: false,
    valid: true,
  });
});

for (const args of [[], ["owner/skill", "extra"], ["--json"], ["test-skill", "--bad-flag"]]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parseViewFlags(args);
    assert.equal(parsed.valid, false);
  });
}
