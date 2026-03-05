const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runListCommand } = requireDist("commands/list.js");

function lockEntry(skillId, agentTarget = "skillmd") {
  const skill = skillId.split("/")[1];
  return {
    skillId,
    ownerLogin: "owner",
    skill,
    selectorSpec: "latest",
    resolvedVersion: "1.0.0",
    digest: "sha256:test",
    sizeBytes: 1,
    mediaType: "application/octet-stream",
    installedPath: `/workspace/.agent/skills/registry.example.com/owner/${skill}`,
    registryBaseUrl: "https://registry.example.com",
    installedAt: "2026-03-01T00:00:00.000Z",
    sourceCommand: "skillmd use @owner/skill",
    downloadedFrom: "https://storage.example.com",
    agentTarget,
  };
}

test("fails with usage on invalid args", async () => {
  const result = await runListCommand(["--bad-flag"]);
  assert.equal(result, 1);
});

test("prints no installed skills when lock is empty", async () => {
  const { result, logs } = await captureConsole(() =>
    runListCommand([], {
      cwd: "/workspace",
      getConfig: () => ({
        firebaseProjectId: "skillmarkdown-development",
        registryBaseUrl: "https://registry.example.com",
        requestTimeoutMs: 1000,
        defaultAgentTarget: "skillmd",
      }),
      loadSkillsLock: async () => ({ lockfileVersion: 1, generatedAt: "", entries: {} }),
    }),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /No installed skills found/i);
});

test("prints json results and supports --agent-target", async () => {
  const { result, logs } = await captureConsole(() =>
    runListCommand(["--agent-target", "claude", "--json"], {
      cwd: "/workspace",
      getConfig: () => ({
        firebaseProjectId: "skillmarkdown-development",
        registryBaseUrl: "https://registry.example.com",
        requestTimeoutMs: 1000,
        defaultAgentTarget: "skillmd",
      }),
      loadSkillsLock: async () => ({
        lockfileVersion: 1,
        generatedAt: "",
        entries: {
          a: lockEntry("@owner/skill-a", "skillmd"),
          b: lockEntry("@owner/skill-b", "claude"),
        },
      }),
    }),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.total, 1);
  assert.equal(payload.entries[0].skillId, "@owner/skill-b");
});
