const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseUseFlags } = requireDist("lib/use/flags.js");

test("parses skill id with default selector behavior", () => {
  const parsed = parseUseFlags(["@stefdevscore/test-skill"]);

  assert.deepEqual(parsed, {
    skillId: "@stefdevscore/test-skill",
    version: undefined,
    channel: undefined,
    allowYanked: false,
    json: false,
    valid: true,
  });
});

test("parses version selector with allow-yanked and json flags", () => {
  const parsed = parseUseFlags(["owner/skill", "--version", "1.2.3", "--allow-yanked", "--json"]);

  assert.deepEqual(parsed, {
    skillId: "owner/skill",
    version: "1.2.3",
    channel: undefined,
    allowYanked: true,
    json: true,
    valid: true,
  });
});

test("parses channel selector in equals form", () => {
  const parsed = parseUseFlags(["owner/skill", "--channel=beta"]);

  assert.deepEqual(parsed, {
    skillId: "owner/skill",
    version: undefined,
    channel: "beta",
    allowYanked: false,
    json: false,
    valid: true,
  });
});

for (const args of [
  [],
  ["owner/skill", "--version", "x"],
  ["owner/skill", "--channel", "rc"],
  ["owner/skill", "--version", "1.2.3", "--channel", "latest"],
  ["owner/skill", "--unknown"],
]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parseUseFlags(args);
    assert.equal(parsed.valid, false);
  });
}
