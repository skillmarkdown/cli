const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");
const {
  discoverInstalledSkills,
  discoverInstalledSkillsAcrossTargets,
  readInstalledSkillMetadata,
  toInstalledSkillTarget,
} = require("../helpers/update-discovery-helper.js");

const TEST_PREFIX = "skillmd-update-discovery-";

function writeLockfile(root, entries) {
  fs.writeFileSync(
    path.join(root, "skills-lock.json"),
    JSON.stringify(
      {
        lockfileVersion: 1,
        generatedAt: "2026-03-02T00:00:00.000Z",
        entries,
      },
      null,
      2,
    ),
    "utf8",
  );
}

test("discoverInstalledSkills reads entries from lockfile for a target", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    writeLockfile(root, {
      a: {
        skillId: "@owner-a/skill-a",
        ownerLogin: "owner-a",
        skill: "skill-a",
        selectorSpec: "latest",
        resolvedVersion: "1.0.0",
        digest: "sha256:a",
        sizeBytes: 1,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/a",
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T00:00:00.000Z",
        sourceCommand: "skillmd use @owner-a/skill-a",
        downloadedFrom: "https://storage.example.com",
        agentTarget: "skillmd",
      },
      b: {
        skillId: "@owner-b/skill-b",
        ownerLogin: "owner-b",
        skill: "skill-b",
        selectorSpec: "latest",
        resolvedVersion: "1.0.0",
        digest: "sha256:b",
        sizeBytes: 1,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/b",
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T00:00:00.000Z",
        sourceCommand: "skillmd use @owner-b/skill-b",
        downloadedFrom: "https://storage.example.com",
        agentTarget: "claude",
      },
    });

    const skillmdEntries = await discoverInstalledSkills(
      root,
      "https://registry.example.com",
      "skillmd",
    );
    assert.deepEqual(
      skillmdEntries.map((entry) => entry.skillId),
      ["@owner-a/skill-a"],
    );
    assert.equal(skillmdEntries[0].agentTarget, "skillmd");
  } finally {
    cleanupDirectory(root);
  }
});

test("discoverInstalledSkillsAcrossTargets returns all matching registry entries", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    writeLockfile(root, {
      a: {
        skillId: "@owner-a/skill-a",
        ownerLogin: "owner-a",
        skill: "skill-a",
        selectorSpec: "latest",
        resolvedVersion: "1.0.0",
        digest: "sha256:a",
        sizeBytes: 1,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/a",
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T00:00:00.000Z",
        sourceCommand: "skillmd use @owner-a/skill-a",
        downloadedFrom: "https://storage.example.com",
        agentTarget: "skillmd",
      },
      b: {
        skillId: "@owner-c/skill-c",
        ownerLogin: "owner-c",
        skill: "skill-c",
        selectorSpec: "latest",
        resolvedVersion: "1.0.0",
        digest: "sha256:c",
        sizeBytes: 1,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/c",
        registryBaseUrl: "https://another.example.com",
        installedAt: "2026-03-02T00:00:00.000Z",
        sourceCommand: "skillmd use @owner-c/skill-c",
        downloadedFrom: "https://storage.example.com",
        agentTarget: "gemini",
      },
    });

    const discovered = await discoverInstalledSkillsAcrossTargets(
      root,
      "https://registry.example.com",
    );
    assert.deepEqual(
      discovered.map((entry) => `${entry.skillId}:${entry.agentTarget}`),
      ["@owner-a/skill-a:skillmd"],
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("readInstalledSkillMetadata resolves entry by installed path via workspace lockfile", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const installedPath = path.join(
      root,
      ".agent/skills/registry.skillmarkdown.com/owner-a/skill-a",
    );
    fs.mkdirSync(installedPath, { recursive: true });

    writeLockfile(root, {
      a: {
        skillId: "@owner-a/skill-a",
        ownerLogin: "owner-a",
        skill: "skill-a",
        selectorSpec: "latest",
        resolvedVersion: "1.0.0",
        digest: "sha256:a",
        sizeBytes: 1,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath,
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T00:00:00.000Z",
        sourceCommand: "skillmd use @owner-a/skill-a",
        downloadedFrom: "https://storage.example.com",
        agentTarget: "skillmd",
      },
    });

    const metadata = await readInstalledSkillMetadata(installedPath);
    assert.ok(metadata, "expected metadata from lockfile");
    assert.equal(metadata.skillId, "@owner-a/skill-a");
    assert.equal(metadata.installedPath, installedPath);
  } finally {
    cleanupDirectory(root);
  }
});

test("toInstalledSkillTarget computes canonical install path for target", () => {
  const target = toInstalledSkillTarget(
    "/workspace",
    "https://registry.example.com",
    "@owner-a/skill-a",
    "claude",
  );

  assert.equal(target.skillId, "@owner-a/skill-a");
  assert.equal(target.agentTarget, "claude");
  assert.equal(
    target.installedPath,
    "/workspace/.claude/skills/registry.skillmarkdown.com/owner-a/skill-a",
  );
});
