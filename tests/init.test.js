const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { scaffoldSkillInDirectory } = require("../dist/lib/scaffold.js");
const { createSkillDirectoryFactory, cleanupDirectory } = require("./helpers/fs-test-utils.js");

const makeEmptySkillDirectory = createSkillDirectoryFactory("skillmd-test-");

function listFilesRecursively(dir, relative = "") {
  const fullPath = relative ? path.join(dir, relative) : dir;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relPath = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(dir, relPath));
    } else {
      files.push(relPath);
    }
  }

  return files.sort();
}

function snapshotDirectory(dir) {
  const files = listFilesRecursively(dir);
  return files.map((file) => ({
    file,
    content: fs.readFileSync(path.join(dir, file), "utf8"),
  }));
}

test("scaffolds required files and template sections", () => {
  const { root, dir } = makeEmptySkillDirectory("sample-skill");

  try {
    const result = scaffoldSkillInDirectory(dir);
    assert.equal(result.skillName, "sample-skill");

    const expectedFiles = [
      ".gitignore",
      "SKILL.md",
      "assets/.gitkeep",
      "references/.gitkeep",
      "scripts/.gitkeep",
    ];

    assert.deepEqual(listFilesRecursively(dir), expectedFiles);

    const skillMd = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
    assert.match(skillMd, /^---\nname: sample-skill\n/m);
    assert.match(skillMd, /## Scope/);
    assert.match(skillMd, /## When to use/);
    assert.match(skillMd, /## Inputs/);
    assert.match(skillMd, /## Outputs/);
    assert.match(skillMd, /## Steps \/ Procedure/);
    assert.match(skillMd, /## Examples/);
    assert.match(skillMd, /## Limitations \/ Failure modes/);
    assert.match(skillMd, /## Security \/ Tool access/);
  } finally {
    cleanupDirectory(root);
  }
});

test("fails when target directory is non-empty", () => {
  const { root, dir } = makeEmptySkillDirectory("non-empty-skill");

  try {
    fs.writeFileSync(path.join(dir, "existing.txt"), "content", "utf8");
    assert.throws(() => scaffoldSkillInDirectory(dir), /not empty/);
  } finally {
    cleanupDirectory(root);
  }
});

test("produces deterministic output in separate empty directories", () => {
  const first = makeEmptySkillDirectory("deterministic-skill");
  const second = makeEmptySkillDirectory("deterministic-skill");

  try {
    scaffoldSkillInDirectory(first.dir);
    scaffoldSkillInDirectory(second.dir);

    assert.deepEqual(snapshotDirectory(first.dir), snapshotDirectory(second.dir));
  } finally {
    cleanupDirectory(first.root);
    cleanupDirectory(second.root);
  }
});

test("fails when current directory name is not normalized", () => {
  const { root, dir } = makeEmptySkillDirectory("Not_Valid");

  try {
    assert.throws(() => scaffoldSkillInDirectory(dir), /must already be normalized/);
  } finally {
    cleanupDirectory(root);
  }
});
