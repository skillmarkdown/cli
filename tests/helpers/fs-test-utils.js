const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function makeTempDirectory(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeEmptySkillDirectory(prefix, skillName) {
  const root = makeTempDirectory(prefix);
  const dir = path.join(root, skillName);
  fs.mkdirSync(dir);
  return { root, dir };
}

function createSkillDirectoryFactory(prefix) {
  return (skillName) => makeEmptySkillDirectory(prefix, skillName);
}

function cleanupDirectory(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  makeTempDirectory,
  makeEmptySkillDirectory,
  createSkillDirectoryFactory,
  cleanupDirectory,
};
