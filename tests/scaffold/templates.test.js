const test = require("node:test");
const assert = require("node:assert/strict");
const { requireDist } = require("../helpers/dist-imports.js");
const fs = require("node:fs");
const path = require("node:path");

const { buildGitignore, buildMinimalSkillMarkdown, buildVerboseSkillMarkdown } = requireDist(
  "lib/scaffold/templates/index.js",
);

function readFixture(...segments) {
  return fs.readFileSync(path.join(__dirname, "fixtures", "templates", ...segments), "utf8");
}

test("minimal template matches fixture", () => {
  const expected = readFixture("minimal", "SKILL.md");
  const generated = buildMinimalSkillMarkdown("fixture-skill");
  assert.equal(generated, expected);
});

test("verbose template matches fixture", () => {
  const expected = readFixture("verbose", "SKILL.md");
  const generated = buildVerboseSkillMarkdown("fixture-skill");
  assert.equal(generated, expected);
});

test("verbose .gitignore matches fixture", () => {
  const expected = readFixture("verbose", ".gitignore");
  const generated = buildGitignore();
  assert.equal(generated, expected);
});
