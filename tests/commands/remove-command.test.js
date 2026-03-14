const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runRemoveCommand } = requireDist("commands/remove.js");

function lockEntry(overrides = {}) {
  const skillId = overrides.skillId ?? "@username/skill-a";
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
    installedPath: overrides.installedPath ?? `/workspace/.agent/skills/${skill}`,
    registryBaseUrl: "https://registry.example.com",
    installedAt: "2026-03-01T00:00:00.000Z",
    sourceCommand: "skillmd use @username/skill",
    downloadedFrom: "https://storage.example.com",
    agentTarget: overrides.agentTarget ?? "skillmd",
  };
}

test("fails with usage on invalid args", async () => {
  const result = await runRemoveCommand([]);
  assert.equal(result, 1);
});

test("fails with usage on invalid skill id without throwing", async () => {
  const { result, errors } = await captureConsole(() => runRemoveCommand(["bad"]));
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /Usage: skillmd remove/);
});

test("fails when skill is not installed", async () => {
  const { result, errors } = await captureConsole(() =>
    runRemoveCommand(["@username/missing"], {
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
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not installed/i);
});

test("removes installed skill and updates lock", async () => {
  let removedPath = "";
  let savedLock;
  const { result, logs } = await captureConsole(() =>
    runRemoveCommand(["@username/skill-a"], {
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
        entries: { a: lockEntry() },
      }),
      saveSkillsLock: async (_cwd, lock) => {
        savedLock = lock;
      },
      removePath: async (path) => {
        removedPath = path;
      },
    }),
  );
  assert.equal(result, 0);
  assert.equal(removedPath, "/workspace/.agent/skills/skill-a");
  assert.equal(Object.keys(savedLock.entries).length, 0);
  assert.match(logs.join("\n"), /Removed 1 install/);
});

test("prints json output and returns non-zero on failures", async () => {
  const { result, logs } = await captureConsole(() =>
    runRemoveCommand(["@username/skill-a", "--json"], {
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
          a: lockEntry({ installedPath: "/tmp/not-canonical" }),
        },
      }),
      saveSkillsLock: async () => {},
      removePath: async () => {},
    }),
  );
  assert.equal(result, 1);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.removed, 0);
  assert.equal(payload.failed.length, 1);
});

test("remove --global validates and removes global install paths", async () => {
  let removedPath;
  let saveArgs;
  const { result } = await captureConsole(() =>
    runRemoveCommand(["@username/skill-a", "--global", "--agent-target", "openai"], {
      cwd: "/workspace/project",
      homeDir: "/Users/tester",
      env: {
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
        SKILLMD_REGISTRY_BASE_URL: "https://registry.skillmarkdown.com",
        SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
      },
      getConfig: () => ({
        firebaseProjectId: "skillmarkdown-development",
        registryBaseUrl: "https://registry.skillmarkdown.com",
        requestTimeoutMs: 10000,
        defaultAgentTarget: "skillmd",
      }),
      loadSkillsLock: async () => ({
        lockfileVersion: 1,
        generatedAt: "2026-03-02T00:00:00.000Z",
        entries: {
          a: {
            skillId: "@username/skill-a",
            username: "username",
            skill: "skill-a",
            selectorSpec: "latest",
            resolvedVersion: "1.0.0",
            digest: "sha256:test",
            sizeBytes: 1,
            mediaType: "application/test",
            installedPath: "/Users/tester/.codex/skills/skill-a",
            registryBaseUrl: "https://registry.skillmarkdown.com",
            installedAt: "2026-03-02T00:00:00.000Z",
            sourceCommand: "skillmd use --global @username/skill-a --agent-target openai",
            downloadedFrom: "https://storage.example.com",
            agentTarget: "openai",
          },
        },
      }),
      saveSkillsLock: async (...args) => {
        saveArgs = args;
      },
      removePath: async (path) => {
        removedPath = path;
      },
    }),
  );

  assert.equal(result, 0);
  assert.equal(removedPath, "/Users/tester/.codex/skills/skill-a");
  assert.equal(saveArgs[3].scope, "global");
});
