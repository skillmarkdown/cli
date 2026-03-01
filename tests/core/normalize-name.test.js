const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { normalizeSkillName, getMaxSkillNameLength } = requireDist("lib/normalize-name.js");

test("normalizes mixed separators to lowercase hyphen-case", () => {
  assert.equal(normalizeSkillName("  My__Skill Name  "), "my-skill-name");
});

test("keeps valid names unchanged", () => {
  assert.equal(normalizeSkillName("code-review"), "code-review");
});

test("throws when normalized value is empty", () => {
  assert.throws(() => normalizeSkillName("___"), /empty after normalization/);
});

test("throws when skill name exceeds max length", () => {
  assert.throws(() => normalizeSkillName("a".repeat(getMaxSkillNameLength() + 1)), /at most/);
});
