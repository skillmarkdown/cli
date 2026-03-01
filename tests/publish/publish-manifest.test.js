const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { cleanupDirectory, makeTempDirectory } = require("../helpers/fs-test-utils.js");

const { buildPublishManifest } = requireDist("lib/publish/manifest.js");

const MANIFEST_TEST_PREFIX = "skillmd-publish-manifest-";

function artifactFixture() {
  return {
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    digest: "sha256:abc",
    sizeBytes: 123,
    tarGz: Buffer.from("tar"),
    files: [{ path: "SKILL.md", sizeBytes: 55, sha256: "aaa" }],
  };
}

test("buildPublishManifest returns stable schema fields", () => {
  const root = makeTempDirectory(MANIFEST_TEST_PREFIX);
  const dir = path.join(root, "manifest-skill");
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: manifest-skill\ndescription: Example description\n---\n\nBody\n`,
    "utf8",
  );

  try {
    const manifest = buildPublishManifest({
      targetDir: dir,
      skill: "manifest-skill",
      version: "1.0.0",
      channel: "latest",
      artifact: artifactFixture(),
    });

    assert.equal(manifest.schemaVersion, "skillmd.publish.v1");
    assert.equal(manifest.skill, "manifest-skill");
    assert.equal(manifest.version, "1.0.0");
    assert.equal(manifest.channel, "latest");
    assert.equal(manifest.description, "Example description");
    assert.deepEqual(manifest.files, [{ path: "SKILL.md", sizeBytes: 55, sha256: "aaa" }]);
  } finally {
    cleanupDirectory(root);
  }
});
