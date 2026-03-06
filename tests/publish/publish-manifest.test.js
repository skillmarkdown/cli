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
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "manifest-skill",
        version: "1.0.0",
        homepage: "https://github.com/skillmarkdown/cli#readme",
        repository: {
          type: "git",
          url: "https://github.com/skillmarkdown/cli",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  try {
    const manifest = buildPublishManifest({
      targetDir: dir,
      skill: "manifest-skill",
      version: "1.0.0",
      tag: "latest",
      access: "public",
      provenance: false,
      artifact: artifactFixture(),
    });

    assert.equal(manifest.schemaVersion, "skillmd.publish.v1");
    assert.equal(manifest.skill, "manifest-skill");
    assert.equal(manifest.version, "1.0.0");
    assert.equal(manifest.tag, "latest");
    assert.equal(manifest.access, "public");
    assert.equal(manifest.provenance, false);
    assert.equal(manifest.description, "Example description");
    assert.equal(manifest.homepage, "https://github.com/skillmarkdown/cli#readme");
    assert.equal(manifest.repository, "https://github.com/skillmarkdown/cli");
    assert.deepEqual(manifest.files, [{ path: "SKILL.md", sizeBytes: 55, sha256: "aaa" }]);
  } finally {
    cleanupDirectory(root);
  }
});

test("buildPublishManifest omits invalid repository and homepage values", () => {
  const root = makeTempDirectory(MANIFEST_TEST_PREFIX);
  const dir = path.join(root, "manifest-skill");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "SKILL.md"), "Body\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "manifest-skill",
        version: "1.0.0",
        homepage: "notaurl",
        repository: { url: "git+ssh://github.com/skillmarkdown/cli.git" },
      },
      null,
      2,
    ),
    "utf8",
  );

  try {
    const manifest = buildPublishManifest({
      targetDir: dir,
      skill: "manifest-skill",
      version: "1.0.0",
      tag: "latest",
      access: "public",
      provenance: false,
      artifact: artifactFixture(),
    });

    assert.equal(manifest.homepage, undefined);
    assert.equal(manifest.repository, undefined);
  } finally {
    cleanupDirectory(root);
  }
});

test("buildPublishManifest reads description from BOM-prefixed frontmatter", () => {
  const root = makeTempDirectory(MANIFEST_TEST_PREFIX);
  const dir = path.join(root, "manifest-skill");
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `\uFEFF---\nname: manifest-skill\ndescription: Description with BOM\n---\n\nBody\n`,
    "utf8",
  );

  try {
    const manifest = buildPublishManifest({
      targetDir: dir,
      skill: "manifest-skill",
      version: "1.0.0",
      tag: "latest",
      access: "public",
      provenance: false,
      artifact: artifactFixture(),
    });

    assert.equal(manifest.description, "Description with BOM");
  } finally {
    cleanupDirectory(root);
  }
});

test("buildPublishManifest reads description from BOM-prefixed CRLF frontmatter", () => {
  const root = makeTempDirectory(MANIFEST_TEST_PREFIX);
  const dir = path.join(root, "manifest-skill");
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `\uFEFF---\r\nname: manifest-skill\r\ndescription: Description with BOM and CRLF\r\n---\r\n\r\nBody\r\n`,
    "utf8",
  );

  try {
    const manifest = buildPublishManifest({
      targetDir: dir,
      skill: "manifest-skill",
      version: "1.0.0",
      tag: "latest",
      access: "public",
      provenance: false,
      artifact: artifactFixture(),
    });

    assert.equal(manifest.description, "Description with BOM and CRLF");
  } finally {
    cleanupDirectory(root);
  }
});
