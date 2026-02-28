const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSkillName,
  getMaxSkillNameLength,
} = require("../dist/lib/normalize-name.js");

test("normalizes mixed separators to lowercase hyphen-case", () => {
  assert.equal(normalizeSkillName("  My__Skill Name  "), "my-skill-name");
});

test("keeps valid names unchanged", () => {
  assert.equal(normalizeSkillName("code-review"), "code-review");
});

test("throws when normalized value is empty", () => {
  assert.throws(
    () => normalizeSkillName("___"),
    /empty after normalization/,
  );
});

test("throws when skill name exceeds max length", () => {
  const tooLong = "a".repeat(getMaxSkillNameLength() + 1);
  assert.throws(
    () => normalizeSkillName(tooLong),
    /at most/,
  );
});
