const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { loadSkillsLock } = requireDist("lib/workspace/skills-lock.js");

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
      skillId: "@owner/skill-a",
      ownerLogin: "owner",
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
      sourceCommand: "skillmd use @owner/skill-a",
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
