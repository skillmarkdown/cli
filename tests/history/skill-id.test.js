const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseSkillId } = requireDist("lib/registry/skill-id.js");

test("parseSkillId accepts bare skill ids and normalizes casing", () => {
  const parsed = parseSkillId("Test-Skill");
  assert.deepEqual(parsed, {
    username: "",
    skillSlug: "test-skill",
    skillId: "test-skill",
  });
});

test("parseSkillId accepts @org/skill and normalizes casing", () => {
  const parsed = parseSkillId("@StefDevScore/Test-Skill");
  assert.deepEqual(parsed, {
    username: "stefdevscore",
    skillSlug: "test-skill",
    skillId: "@stefdevscore/test-skill",
  });
});

test("parseSkillId rejects legacy username/skill format", () => {
  assert.throws(() => parseSkillId("stefdevscore/test-skill"), /@org\/skill/);
});

for (const input of [
  "/skill",
  "owner/",
  "@-username/skill",
  "username/skill_underscore",
  "username/skill-",
]) {
  test(`parseSkillId rejects invalid input: ${input}`, () => {
    assert.throws(
      () => parseSkillId(input),
      /bare skill slug or @org\/skill|scoped skill ids must use the form @org\/skill|valid slug/,
    );
  });
}
