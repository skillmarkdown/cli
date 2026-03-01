const fs = require("node:fs");
const path = require("node:path");

const { cleanupDirectory, createSkillDirectoryFactory } = require("./fs-test-utils.js");
const { requireDist } = require("./dist-imports.js");

const { scaffoldSkillInDirectory } = requireDist("lib/scaffold.js");

const SKILL_MD = "SKILL.md";

function withSkillDirectory(prefix, skillName, run) {
  const makeEmptySkillDirectory = createSkillDirectoryFactory(prefix);
  const { root, dir } = makeEmptySkillDirectory(skillName);

  try {
    return run({ root, dir });
  } finally {
    cleanupDirectory(root);
  }
}

function withScaffoldedSkillDirectory(prefix, skillName, template, run) {
  return withSkillDirectory(prefix, skillName, ({ root, dir }) => {
    scaffoldSkillInDirectory(dir, { template });
    return run({ root, dir });
  });
}

function readSkillMarkdown(dir) {
  return fs.readFileSync(path.join(dir, SKILL_MD), "utf8");
}

function writeSkillMarkdown(dir, content) {
  fs.writeFileSync(path.join(dir, SKILL_MD), content, "utf8");
}

function patchSkillMarkdown(dir, patcher) {
  writeSkillMarkdown(dir, patcher(readSkillMarkdown(dir)));
}

module.exports = {
  withSkillDirectory,
  withScaffoldedSkillDirectory,
  readSkillMarkdown,
  writeSkillMarkdown,
  patchSkillMarkdown,
};
