const test = require("node:test");
const assert = require("node:assert/strict");
const { requireDist } = require("../helpers/dist-imports.js");

const {
  INIT_TEMPLATE_IDS,
  MAX_SKILL_NAME_LENGTH,
  SCAFFOLD_DIRECTORIES,
  STRICT_REQUIRED_FILES,
  STRICT_SECTION_HEADINGS,
} = requireDist("lib/skill-spec.js");
const { getMaxSkillNameLength } = requireDist("lib/normalize-name.js");
const { buildVerboseSkillMarkdown } = requireDist("lib/templates.js");

test("shared max skill name length stays in sync", () => {
  assert.equal(MAX_SKILL_NAME_LENGTH, getMaxSkillNameLength());
});

test("strict required files include .gitkeep for all scaffold directories", () => {
  for (const directory of SCAFFOLD_DIRECTORIES) {
    assert.equal(STRICT_REQUIRED_FILES.includes(`${directory}/.gitkeep`), true);
  }
});

test("template contains every strict section heading", () => {
  const markdown = buildVerboseSkillMarkdown("sample-skill");
  for (const heading of STRICT_SECTION_HEADINGS) {
    assert.equal(markdown.includes(heading), true);
  }
});

test("init template ids are stable and ordered", () => {
  assert.deepEqual(INIT_TEMPLATE_IDS, ["minimal", "verbose"]);
});
