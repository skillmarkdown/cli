const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { cleanupDirectory, makeTempDirectory } = require("../helpers/fs-test-utils.js");

const { packSkillArtifact } = requireDist("lib/publish/pack.js");

const PACK_TEST_PREFIX = "skillmd-publish-pack-";

function makeSkillFixture() {
  const root = makeTempDirectory(PACK_TEST_PREFIX);
  const dir = path.join(root, "pack-skill");
  fs.mkdirSync(dir);

  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: pack-skill\ndescription: Pack fixture\n---\n\n# Body\n`,
    "utf8",
  );
  fs.mkdirSync(path.join(dir, "references"));
  fs.writeFileSync(path.join(dir, "references", "REFERENCE.md"), "Reference", "utf8");

  fs.mkdirSync(path.join(dir, "node_modules"));
  fs.writeFileSync(path.join(dir, "node_modules", "ignored.txt"), "ignored", "utf8");

  fs.mkdirSync(path.join(dir, ".git"));
  fs.writeFileSync(path.join(dir, ".git", "ignored.txt"), "ignored", "utf8");

  fs.writeFileSync(path.join(dir, ".DS_Store"), "ignored", "utf8");

  return { root, dir };
}

function makeOrderingFixture() {
  const root = makeTempDirectory(PACK_TEST_PREFIX);
  const dir = path.join(root, "ordering-skill");
  fs.mkdirSync(dir);

  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: ordering-skill\ndescription: Ordering fixture\n---\n\nBody\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(dir, "a.txt"), "a", "utf8");
  fs.mkdirSync(path.join(dir, "a"));
  fs.writeFileSync(path.join(dir, "a", "z.txt"), "z", "utf8");

  return { root, dir };
}

test("packSkillArtifact is deterministic and excludes ignored paths", () => {
  const { root, dir } = makeSkillFixture();

  try {
    const first = packSkillArtifact(dir);
    const second = packSkillArtifact(dir);

    assert.equal(first.digest, second.digest);
    assert.equal(first.sizeBytes, second.sizeBytes);
    assert.deepEqual(
      first.files.map((entry) => entry.path),
      ["SKILL.md", "references/REFERENCE.md"],
    );
    assert.equal(first.mediaType, "application/vnd.skillmarkdown.skill.v1+tar");
  } finally {
    cleanupDirectory(root);
  }
});

test("packSkillArtifact digest changes when file content changes", () => {
  const { root, dir } = makeSkillFixture();

  try {
    const before = packSkillArtifact(dir);
    fs.writeFileSync(path.join(dir, "references", "REFERENCE.md"), "Reference changed", "utf8");
    const after = packSkillArtifact(dir);

    assert.notEqual(before.digest, after.digest);
  } finally {
    cleanupDirectory(root);
  }
});

test("packSkillArtifact applies global lexicographic path ordering", () => {
  const { root, dir } = makeOrderingFixture();

  try {
    const packed = packSkillArtifact(dir);
    assert.deepEqual(
      packed.files.map((entry) => entry.path),
      ["SKILL.md", "a.txt", "a/z.txt"],
    );
  } finally {
    cleanupDirectory(root);
  }
});
