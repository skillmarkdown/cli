const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const tar = require("tar");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");
const { requireDist } = require("../helpers/dist-imports.js");

const { installSkillArtifact } = requireDist("lib/use/install.js");
const { verifyDownloadedArtifact } = requireDist("lib/use/integrity.js");

const TEST_PREFIX = "skillmd-use-install-";

async function createArchiveBytes(files) {
  const root = makeTempDirectory(TEST_PREFIX);
  const sourceDir = path.join(root, "source");
  const archivePath = path.join(root, "artifact.tgz");

  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(sourceDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, "utf8");
    }

    await tar.c({ gzip: true, file: archivePath, cwd: sourceDir }, ["."]);
    return fs.readFileSync(archivePath);
  } finally {
    cleanupDirectory(root);
  }
}

async function createArchiveBytesWithSymlink(linkPath, targetPath, files = {}) {
  const root = makeTempDirectory(TEST_PREFIX);
  const sourceDir = path.join(root, "source");
  const archivePath = path.join(root, "artifact.tgz");

  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(sourceDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, "utf8");
    }
    fs.mkdirSync(path.dirname(path.join(sourceDir, linkPath)), { recursive: true });
    fs.symlinkSync(targetPath, path.join(sourceDir, linkPath));

    await tar.c({ gzip: true, file: archivePath, cwd: sourceDir }, ["."]);
    return fs.readFileSync(archivePath);
  } finally {
    cleanupDirectory(root);
  }
}

async function createArchiveBytesWithHardlink(linkPath, targetPath, files = {}) {
  const root = makeTempDirectory(TEST_PREFIX);
  const sourceDir = path.join(root, "source");
  const archivePath = path.join(root, "artifact.tgz");

  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(sourceDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, "utf8");
    }
    fs.linkSync(path.join(sourceDir, targetPath), path.join(sourceDir, linkPath));

    await tar.c({ gzip: true, file: archivePath, cwd: sourceDir }, ["."]);
    return fs.readFileSync(archivePath);
  } finally {
    cleanupDirectory(root);
  }
}

test("verifyDownloadedArtifact validates descriptor against bytes", async () => {
  const bytes = Buffer.from("hello", "utf8");
  const descriptor = {
    owner: "@owner",
    username: "username",
    skill: "skill",
    version: "1.0.0",
    digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    sizeBytes: 5,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    deprecated: false,
    deprecatedAt: null,
    deprecatedMessage: null,
    downloadUrl: "https://storage.example.com/o",
    downloadExpiresAt: "2026-03-02T12:00:00.000Z",
  };

  verifyDownloadedArtifact(descriptor, bytes, "application/vnd.skillmarkdown.skill.v1+tar");

  assert.throws(() => {
    verifyDownloadedArtifact(
      { ...descriptor, digest: "sha256:bad" },
      bytes,
      "application/vnd.skillmarkdown.skill.v1+tar",
    );
  }, /digest mismatch/i);

  assert.throws(() => {
    verifyDownloadedArtifact(
      { ...descriptor, sizeBytes: 10 },
      bytes,
      "application/vnd.skillmarkdown.skill.v1+tar",
    );
  }, /size mismatch/i);

  assert.throws(() => {
    verifyDownloadedArtifact({ ...descriptor }, bytes, "application/octet-stream");
  }, /content-type mismatch/i);
});

test("installSkillArtifact replaces existing target atomically without writing metadata file", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytes({
      "SKILL.md": "---\nname: test\n---\n",
      "scripts/run.sh": "#!/usr/bin/env bash\necho hi\n",
    });
    const targetPath = path.join(
      root,
      ".agent",
      "skills",
      "registry.example.com",
      "owner",
      "test-skill",
    );
    const tempRoot = path.join(root, ".agent", ".tmp");

    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(targetPath, "old.txt"), "old", "utf8");

    await installSkillArtifact({
      targetPath,
      tempRoot,
      archiveBytes,
    });

    assert.equal(fs.existsSync(path.join(targetPath, "SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(targetPath, "scripts", "run.sh")), true);
    assert.equal(fs.existsSync(path.join(targetPath, "old.txt")), false);

    const hiddenFiles = await fsp.readdir(targetPath);
    assert.equal(
      hiddenFiles.some((name) => name.endsWith(".json")),
      false,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact fails when SKILL.md is missing from archive root", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytes({
      "README.md": "not a skill",
    });

    await assert.rejects(
      installSkillArtifact({
        targetPath: path.join(
          root,
          ".agent",
          "skills",
          "registry.example.com",
          "owner",
          "bad-skill",
        ),
        tempRoot: path.join(root, ".agent", ".tmp"),
        archiveBytes,
      }),
      /SKILL\.md/i,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact fails when SKILL.md is a symlink", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytesWithSymlink("SKILL.md", "REAL.md", {
      "REAL.md": "---\nname: not-regular\n---\n",
    });

    await assert.rejects(
      installSkillArtifact({
        targetPath: path.join(
          root,
          ".agent",
          "skills",
          "registry.example.com",
          "owner",
          "symlink-skill",
        ),
        tempRoot: path.join(root, ".agent", ".tmp"),
        archiveBytes,
      }),
      /unsupported symboliclink entry/i,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact fails when archive contains non-SKILL symlink", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytesWithSymlink("scripts/run.sh", "SKILL.md", {
      "SKILL.md": "---\nname: symlinked-script\n---\n",
    });

    await assert.rejects(
      installSkillArtifact({
        targetPath: path.join(
          root,
          ".agent",
          "skills",
          "registry.example.com",
          "owner",
          "symlinked-script",
        ),
        tempRoot: path.join(root, ".agent", ".tmp"),
        archiveBytes,
      }),
      /unsupported symboliclink entry/i,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact fails when archive contains hardlink entry", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytesWithHardlink("COPY.md", "SKILL.md", {
      "SKILL.md": "---\nname: hardlink-skill\n---\n",
    });

    await assert.rejects(
      installSkillArtifact({
        targetPath: path.join(
          root,
          ".agent",
          "skills",
          "registry.example.com",
          "owner",
          "hardlink-skill",
        ),
        tempRoot: path.join(root, ".agent", ".tmp"),
        archiveBytes,
      }),
      /unsupported link entry/i,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact restores previous target if install swap fails", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytes({
      "SKILL.md": "---\nname: restored\n---\n",
    });
    const targetPath = path.join(
      root,
      ".agent",
      "skills",
      "registry.example.com",
      "owner",
      "restore-skill",
    );
    const tempRoot = path.join(root, ".agent", ".tmp");

    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(targetPath, "old.txt"), "old", "utf8");

    const fileOps = {
      access: fsp.access,
      stat: fsp.stat,
      lstat: fsp.lstat,
      mkdir: fsp.mkdir,
      writeFile: fsp.writeFile,
      rm: fsp.rm,
      rename: async (from, to) => {
        if (from.endsWith("/extracted") && to === targetPath) {
          throw new Error("simulated swap failure");
        }
        return fsp.rename(from, to);
      },
    };

    await assert.rejects(
      installSkillArtifact(
        {
          targetPath,
          tempRoot,
          archiveBytes,
        },
        { fileOps },
      ),
      /simulated swap failure/i,
    );

    assert.equal(fs.existsSync(path.join(targetPath, "old.txt")), true);
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact surfaces restore failure details", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytes({
      "SKILL.md": "---\nname: broken-restore\n---\n",
    });
    const targetPath = path.join(
      root,
      ".agent",
      "skills",
      "registry.example.com",
      "owner",
      "broken-restore-skill",
    );
    const tempRoot = path.join(root, ".agent", ".tmp");

    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(targetPath, "old.txt"), "old", "utf8");

    const fileOps = {
      access: fsp.access,
      stat: fsp.stat,
      lstat: fsp.lstat,
      mkdir: fsp.mkdir,
      writeFile: fsp.writeFile,
      rm: fsp.rm,
      rename: async (from, to) => {
        if (from.endsWith("/extracted") && to === targetPath) {
          throw new Error("simulated swap failure");
        }
        if (from.includes("-backup") && to === targetPath) {
          throw new Error("simulated restore failure");
        }
        return fsp.rename(from, to);
      },
    };

    await assert.rejects(
      installSkillArtifact(
        {
          targetPath,
          tempRoot,
          archiveBytes,
        },
        { fileOps },
      ),
      /restore failed/i,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("installSkillArtifact overwrites pre-existing backup before swap", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const archiveBytes = await createArchiveBytes({
      "SKILL.md": "---\nname: overwrite-backup\n---\n",
    });
    const targetPath = path.join(
      root,
      ".agent",
      "skills",
      "registry.example.com",
      "owner",
      "overwrite-backup-skill",
    );
    const tempRoot = path.join(root, ".agent", ".tmp");

    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(targetPath, "old.txt"), "old", "utf8");
    let removedGeneratedBackup = false;

    const fileOps = {
      access: fsp.access,
      stat: fsp.stat,
      lstat: fsp.lstat,
      mkdir: fsp.mkdir,
      writeFile: fsp.writeFile,
      rm: async (target, options) => {
        if (String(target).includes("-backup")) {
          removedGeneratedBackup = true;
        }
        return fsp.rm(target, options);
      },
      rename: fsp.rename,
    };

    await installSkillArtifact(
      {
        targetPath,
        tempRoot,
        archiveBytes,
      },
      { fileOps },
    );

    assert.equal(fs.existsSync(path.join(targetPath, "SKILL.md")), true);
    assert.equal(removedGeneratedBackup, true);
  } finally {
    cleanupDirectory(root);
  }
});
