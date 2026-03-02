const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseUpdateFlags } = requireDist("lib/update/flags.js");

test("parses no-arg update as valid", () => {
  const parsed = parseUpdateFlags([]);

  assert.deepEqual(parsed, {
    all: false,
    allowYanked: false,
    json: false,
    skillIds: [],
    valid: true,
  });
});

test("parses --all with flags", () => {
  const parsed = parseUpdateFlags(["--all", "--allow-yanked", "--json"]);

  assert.deepEqual(parsed, {
    all: true,
    allowYanked: true,
    json: true,
    skillIds: [],
    valid: true,
  });
});

test("parses multiple skill ids", () => {
  const parsed = parseUpdateFlags(["@owner/skill-a", "owner/skill-b"]);

  assert.deepEqual(parsed, {
    all: false,
    allowYanked: false,
    json: false,
    skillIds: ["@owner/skill-a", "owner/skill-b"],
    valid: true,
  });
});

for (const args of [["--all", "@owner/skill"], ["--bad-flag"]]) {
  test(`rejects invalid args: ${args.join(" ")}`, () => {
    const parsed = parseUpdateFlags(args);
    assert.equal(parsed.valid, false);
  });
}
