const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");
const { requireDist } = require("../helpers/dist-imports.js");

const { createEmptySkillsLock, loadSkillsLock, saveSkillsLock, upsertSkillsLockEntry } =
  requireDist("lib/workspace/skills-lock.js");

function validLockfile(entries) {
  return JSON.stringify(
    {
      lockfileVersion: 1,
      generatedAt: "2026-03-02T00:00:00.000Z",
      entries,
    },
    null,
    2,
  );
}

test("loadSkillsLock rejects entries with invalid agentTarget", async () => {
  const rawLockfile = validLockfile({
    a: {
      skillId: "skill-a",
      username: "username",
      skill: "skill-a",
      agentTarget: "bad-target",
      selectorSpec: "latest",
      resolvedVersion: "1.0.0",
      digest: "sha256:a",
      sizeBytes: 1,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      installedPath: "/tmp/a",
      registryBaseUrl: "https://registry.example.com",
      installedAt: "2026-03-02T00:00:00.000Z",
      sourceCommand: "skillmd use skill-a",
      downloadedFrom: "https://storage.example.com",
    },
  });

  await assert.rejects(
    () =>
      loadSkillsLock("/workspace/project", {
        readFile: async () => rawLockfile,
      }),
    /invalid skills lockfile/i,
  );
});

test("loadSkillsLock accepts new builtin agent targets", async () => {
  const rawLockfile = validLockfile({
    a: {
      skillId: "skill-a",
      username: "username",
      skill: "skill-a",
      agentTarget: "meta",
      selectorSpec: "latest",
      resolvedVersion: "1.0.0",
      digest: "sha256:a",
      sizeBytes: 1,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      installedPath: "/tmp/a",
      registryBaseUrl: "https://registry.example.com",
      installedAt: "2026-03-02T00:00:00.000Z",
      sourceCommand: "skillmd use skill-a --agent-target meta",
      downloadedFrom: "https://storage.example.com",
    },
  });

  const loaded = await loadSkillsLock("/workspace/project", {
    readFile: async () => rawLockfile,
  });
  assert.equal(Object.values(loaded.entries)[0].agentTarget, "meta");
});

test("loadSkillsLock accepts bare skill ids with owner username metadata", async () => {
  const rawLockfile = validLockfile({
    a: {
      skillId: "skill-a",
      username: "username",
      skill: "skill-a",
      agentTarget: "skillmd",
      selectorSpec: "latest",
      resolvedVersion: "1.0.0",
      digest: "sha256:a",
      sizeBytes: 1,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      installedPath: "/tmp/a",
      registryBaseUrl: "https://registry.example.com",
      installedAt: "2026-03-02T00:00:00.000Z",
      sourceCommand: "skillmd use skill-a",
      downloadedFrom: "https://storage.example.com",
    },
  });

  const loaded = await loadSkillsLock("/workspace/project", {
    readFile: async () => rawLockfile,
  });
  assert.equal(Object.values(loaded.entries)[0].username, "username");
});

test("saveSkillsLock round-trips lockfile via filesystem", async () => {
  const root = makeTempDirectory("skillmd-skills-lock-");
  try {
    const cwd = path.join(root, "project");
    const now = new Date("2026-03-04T10:00:00.000Z");
    const lock = upsertSkillsLockEntry(
      createEmptySkillsLock(now),
      {
        skillId: "skill-a",
        username: "username",
        skill: "skill-a",
        agentTarget: "skillmd",
        selectorSpec: "latest",
        resolvedVersion: "1.2.3",
        digest: "sha256:abc",
        sizeBytes: 123,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/skills/username/skill-a",
        registryBaseUrl: "https://registry.example.com",
        installedAt: now.toISOString(),
        sourceCommand: "skillmd use skill-a",
        downloadedFrom: "https://storage.example.com",
      },
      now,
    );

    await saveSkillsLock(cwd, lock);
    const loaded = await loadSkillsLock(cwd);
    assert.deepEqual(loaded, lock);
  } finally {
    cleanupDirectory(root);
  }
});

test("saveSkillsLock supports concurrent writes without temp-file collisions", async () => {
  const root = makeTempDirectory("skillmd-skills-lock-");
  try {
    const cwd = path.join(root, "project");
    const now = new Date("2026-03-04T10:00:00.000Z");

    const lockA = upsertSkillsLockEntry(
      createEmptySkillsLock(now),
      {
        skillId: "skill-a",
        username: "username",
        skill: "skill-a",
        agentTarget: "skillmd",
        selectorSpec: "latest",
        resolvedVersion: "1.0.0",
        digest: "sha256:a",
        sizeBytes: 1,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/skills/username/skill-a",
        registryBaseUrl: "https://registry.example.com",
        installedAt: now.toISOString(),
        sourceCommand: "skillmd use skill-a",
        downloadedFrom: "https://storage.example.com",
      },
      now,
    );
    const lockB = upsertSkillsLockEntry(
      createEmptySkillsLock(now),
      {
        skillId: "skill-b",
        username: "username",
        skill: "skill-b",
        agentTarget: "claude",
        selectorSpec: "latest",
        resolvedVersion: "2.0.0",
        digest: "sha256:b",
        sizeBytes: 2,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/tmp/skills/username/skill-b",
        registryBaseUrl: "https://registry.example.com",
        installedAt: now.toISOString(),
        sourceCommand: "skillmd use skill-b --agent-target claude",
        downloadedFrom: "https://storage.example.com",
      },
      now,
    );

    await Promise.all([saveSkillsLock(cwd, lockA), saveSkillsLock(cwd, lockB)]);

    const loaded = await loadSkillsLock(cwd);
    const loadedValues = Object.values(loaded.entries);
    assert.equal(loadedValues.length, 1);
    assert.ok(loadedValues[0].skillId === "skill-a" || loadedValues[0].skillId === "skill-b");

    const files = fs.readdirSync(cwd);
    assert.equal(files.includes("skills-lock.json"), true);
    assert.equal(
      files.some((name) => name.endsWith(".tmp")),
      false,
    );
  } finally {
    cleanupDirectory(root);
  }
});
