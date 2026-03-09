const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runListCommand } = requireDist("commands/list.js");

function lockEntry(skillId, agentTarget = "skillmd") {
  const skill = skillId.split("/")[1];
  return {
    skillId,
    username: "username",
    skill,
    selectorSpec: "latest",
    resolvedVersion: "1.0.0",
    digest: "sha256:test",
    sizeBytes: 1,
    mediaType: "application/octet-stream",
    installedPath: `/workspace/.agent/skills/registry.example.com/username/${skill}`,
    registryBaseUrl: "https://registry.example.com",
    installedAt: "2026-03-01T00:00:00.000Z",
    sourceCommand: "skillmd use @username/skill",
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
    runListCommand(["--global"], {
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
          a: lockEntry("@username/skill-a", "skillmd"),
          b: lockEntry("@username/skill-b", "claude"),
        },
      }),
    }),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.total, 1);
  assert.equal(payload.entries[0].skillId, "@username/skill-b");
});

test("filters json results with new builtin agent target", async () => {
  const { result, logs } = await captureConsole(() =>
    runListCommand(["--agent-target", "perplexity", "--json"], {
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
          a: lockEntry("@username/skill-a", "skillmd"),
          b: lockEntry("@username/skill-b", "perplexity"),
        },
      }),
    }),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.total, 1);
  assert.equal(payload.entries[0].agentTarget, "perplexity");
});

test("list --global reads the global lock scope", async () => {
  let loadArgs;
  const { result, logs } = await captureConsole(() =>
    runListCommand(["--global"], {
      cwd: "/workspace/project",
      homeDir: "/Users/tester",
      env: {
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
        SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
        SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
      },
      getConfig: () => ({
        firebaseProjectId: "skillmarkdown-development",
        registryBaseUrl: "https://registry.example.com",
        requestTimeoutMs: 10000,
        defaultAgentTarget: "skillmd",
      }),
      loadSkillsLock: async (...args) => {
        loadArgs = args;
        return {
          lockfileVersion: 1,
          generatedAt: "2026-03-02T00:00:00.000Z",
          entries: {},
        };
      },
    }),
  );

  assert.equal(result, 0);
  assert.equal(loadArgs[2].scope, "global");
  assert.match(logs.join("\n"), /No installed skills found\./);
});
