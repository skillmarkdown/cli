const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseSkillId } = requireDist("lib/registry/skill-id.js");

test("parseSkillId accepts @owner/skill and normalizes casing", () => {
  const parsed = parseSkillId("@StefDevScore/Test-Skill");
  assert.deepEqual(parsed, {
    ownerSlug: "stefdevscore",
    skillSlug: "test-skill",
    skillId: "@stefdevscore/test-skill",
  });
});

test("parseSkillId accepts owner/skill format", () => {
  const parsed = parseSkillId("stefdevscore/test-skill");
  assert.deepEqual(parsed, {
    ownerSlug: "stefdevscore",
    skillSlug: "test-skill",
    skillId: "@stefdevscore/test-skill",
  });
});

for (const input of [
  "noslash",
  "/skill",
  "owner/",
  "@-owner/skill",
  "owner/skill_underscore",
  "owner/skill-",
]) {
  test(`parseSkillId rejects invalid input: ${input}`, () => {
    assert.throws(() => parseSkillId(input), /skill id must be in the form|valid slug/);
  });
}
