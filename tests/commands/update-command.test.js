const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runUpdateCommand } = requireDist("commands/update.js");
const { UseApiError } = requireDist("lib/use/errors.js");

function lockEntry(overrides = {}) {
  const skillId = overrides.skillId ?? "@username/skill-a";
  const skill = skillId.split("/")[1];
  const agentTarget = overrides.agentTarget ?? "skillmd";
  const installedPath = overrides.installedPath ?? `/workspace/project/.agent/skills/${skill}`;
  return {
    skillId,
    username: "username",
    skill,
    selectorSpec: "latest",
    resolvedVersion: "1.0.0",
    digest: "sha256:old",
    sizeBytes: 5,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    installedPath,
    registryBaseUrl: "https://registry.example.com",
    installedAt: "2026-03-01T00:00:00.000Z",
    sourceCommand: `skillmd use ${skillId}`,
    downloadedFrom: "https://storage.example.com",
    agentTarget,
    ...overrides,
  };
}

function lockFile(entries) {
  return {
    lockfileVersion: 1,
    generatedAt: "2026-03-01T00:00:00.000Z",
    entries,
  };
}

function baseOptions(overrides = {}) {
  return {
    cwd: "/workspace/project",
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
    },
    now: () => new Date("2026-03-02T12:34:56.000Z"),
    getConfig: () => ({
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
      defaultAgentTarget: "skillmd",
    }),
    loadSkillsLock: async () =>
      lockFile({
        a: lockEntry({ skillId: "@username/skill-a" }),
      }),
    saveSkillsLock: async () => {},
    installFromRegistry: async (input) => ({
      result: {
        skillId: `@${input.username}/${input.skillSlug}`,
        username: input.username,
        skill: input.skillSlug,
        version: "1.1.0",
        digest: "sha256:new",
        sizeBytes: 6,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: `/workspace/project/.agent/skills/${input.skillSlug}`,
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T12:34:56.000Z",
        source: "registry",
        agentTarget: input.selectedAgentTarget,
      },
      lockEntry: {
        skillId: `@${input.username}/${input.skillSlug}`,
        username: input.username,
        skill: input.skillSlug,
        selectorSpec: input.selector.spec ?? input.selector.version,
        version: "1.1.0",
        digest: "sha256:new",
        sizeBytes: 6,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: `/workspace/project/.agent/skills/${input.skillSlug}`,
        registryBaseUrl: "https://registry.example.com",
        downloadedFrom: "https://storage.example.com",
        installedAt: "2026-03-02T12:34:56.000Z",
        sourceCommand: `skillmd update @${input.username}/${input.skillSlug}`,
        agentTarget: input.selectedAgentTarget,
      },
    }),
    access: async () => {},
    resolveReadIdToken: async () => null,
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runUpdateCommand(["--all", "@username/skill"]);
  assert.equal(exitCode, 1);
});

test("updates all lockfile entries by default", async () => {
  let savedLock;
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      [],
      baseOptions({
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@username/skill-a" }),
            b: lockEntry({
              skillId: "@username/skill-b",
              installedPath: "/workspace/project/.claude/skills/skill-b",
              agentTarget: "claude",
            }),
          }),
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Summary: total=2 updated=2/);
  assert.equal(Object.keys(savedLock.entries).length, 2);
  assert.deepEqual(
    Object.values(savedLock.entries)
      .map((entry) => entry.sourceCommand)
      .sort(),
    ["skillmd update @username/skill-a", "skillmd update @username/skill-b"],
  );
});

test("filters --all by --agent-target", async () => {
  const installCalls = [];
  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--agent-target", "claude"],
      baseOptions({
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@username/skill-a", agentTarget: "skillmd" }),
            b: lockEntry({
              skillId: "@username/skill-b",
              installedPath: "/workspace/project/.claude/skills/skill-b",
              agentTarget: "claude",
            }),
          }),
        installFromRegistry: async (input) => {
          installCalls.push(input.selectedAgentTarget);
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(installCalls, ["claude"]);
});

test("filters --all by new builtin agent target", async () => {
  const installCalls = [];
  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--agent-target", "deepseek"],
      baseOptions({
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@username/skill-a", agentTarget: "skillmd" }),
            b: lockEntry({
              skillId: "@username/skill-b",
              installedPath: "/workspace/project/.deepseek/skills/skill-b",
              agentTarget: "deepseek",
            }),
          }),
        installFromRegistry: async (input) => {
          installCalls.push(input.selectedAgentTarget);
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(installCalls, ["deepseek"]);
});

test("updates explicit skill ids and reports missing installs", async () => {
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["@username/skill-a", "@username/missing", "--json"],
      baseOptions({
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@username/skill-a" }),
          }),
      }),
    ),
  );

  assert.equal(result, 1);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.updated.length, 1);
  assert.equal(parsed.failed.length, 1);
  assert.match(parsed.failed[0].reason, /not installed/i);
});

test("skips exact-version pinned entries", async () => {
  let installCalls = 0;
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--json"],
      baseOptions({
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({
              skillId: "@username/skill-a",
              selectorSpec: "1.2.3",
              resolvedVersion: "1.2.3",
            }),
          }),
        installFromRegistry: async () => {
          installCalls += 1;
          throw new Error("should not be called");
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(installCalls, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.skipped.length, 1);
  assert.equal(parsed.skipped[0].status, "skipped_pinned");
});

test("continues after update failure and exits non-zero", async () => {
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--json"],
      baseOptions({
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@username/skill-a" }),
            b: lockEntry({ skillId: "@username/skill-b" }),
          }),
        installFromRegistry: async (input) => {
          if (input.skillSlug === "skill-a") {
            throw new UseApiError(404, "not_found", "not found");
          }
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );

  assert.equal(result, 1);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.updated.length, 1);
  assert.equal(parsed.failed.length, 1);
});

test("update --global reads global lock scope and preserves global source command", async () => {
  let loadArgs;
  let saveArgs;
  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--global", "--agent-target", "openai"],
      baseOptions({
        homeDir: "/Users/tester",
        loadSkillsLock: async (...args) => {
          loadArgs = args;
          return lockFile({
            a: lockEntry({
              skillId: "@username/skill-a",
              installedPath: "/Users/tester/.codex/skills/skill-a",
              agentTarget: "openai",
            }),
          });
        },
        saveSkillsLock: async (...args) => {
          saveArgs = args;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(loadArgs[2].scope, "global");
  assert.equal(saveArgs[3].scope, "global");
});
