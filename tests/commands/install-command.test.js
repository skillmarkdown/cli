const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runInstallCommand } = requireDist("commands/install.js");
const { UseApiError } = requireDist("lib/use/errors.js");

function lockEntry(overrides = {}) {
  const skillId = overrides.skillId ?? "skill-a";
  const skill = skillId.includes("/") ? skillId.split("/")[1] : skillId;
  const username = skillId.startsWith("@") ? skillId.slice(1).split("/")[0] : "";
  return {
    skillId,
    username,
    skill,
    selectorSpec: "latest",
    resolvedVersion: "1.0.0",
    digest: "sha256:old",
    sizeBytes: 5,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    installedPath: overrides.installedPath ?? `/workspace/project/.agent/skills/${skill}`,
    registryBaseUrl: "https://registry.example.com",
    installedAt: "2026-03-01T00:00:00.000Z",
    sourceCommand: `skillmd use ${skillId}`,
    downloadedFrom: "https://storage.example.com",
    agentTarget: overrides.agentTarget ?? "skillmd",
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
    loadSkillsManifest: async () => ({
      version: 1,
      defaults: { agentTarget: "skillmd" },
      dependencies: [
        {
          skillId: "skill-a",
          username: "",
          skillSlug: "skill-a",
          spec: "latest",
        },
      ],
    }),
    loadSkillsLock: async () =>
      lockFile({
        a: lockEntry({ skillId: "skill-a", resolvedVersion: "1.0.0" }),
      }),
    saveSkillsLock: async () => {},
    installFromRegistry: async (input) => ({
      result: {
        skillId: input.username ? `@${input.username}/${input.skillSlug}` : input.skillSlug,
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
        skillId: input.username ? `@${input.username}/${input.skillSlug}` : input.skillSlug,
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
        sourceCommand: "skillmd install",
        agentTarget: input.selectedAgentTarget,
      },
      warnings: [],
    }),
    resolveReadIdToken: async () => null,
    removePath: async () => {},
    ...overrides,
  };
}

test("fails with usage on unsupported args", async () => {
  const exitCode = await runInstallCommand(["skill-a"]);
  assert.equal(exitCode, 1);
});

test("fails fast with guidance when skills.json is missing", async () => {
  const { result, errors } = await captureConsole(() =>
    runInstallCommand(
      [],
      baseOptions({
        loadSkillsManifest: async () => {
          throw new Error("skills manifest not found: skills.json");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skills\.json not found/i);
  assert.match(errors.join("\n"), /skillmd use <skill-id>/i);
});

test("installs dependencies and writes lockfile entries", async () => {
  let savedLock;
  const installCalls = [];
  const { result, logs } = await captureConsole(() =>
    runInstallCommand(
      ["--json"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: { agentTarget: "skillmd" },
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
            },
            {
              skillId: "@team/skill-b",
              username: "team",
              skillSlug: "skill-b",
              spec: "^1.2.0",
              agentTarget: "claude",
            },
          ],
        }),
        installFromRegistry: async (input) => {
          installCalls.push(`${input.username}/${input.skillSlug}:${input.selectedAgentTarget}`);
          return baseOptions().installFromRegistry(input);
        },
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(installCalls, ["/skill-a:skillmd", "team/skill-b:claude"]);

  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.total, 2);
  assert.equal(payload.installed.length, 2);
  assert.equal(payload.failed.length, 0);
  assert.equal(payload.skipped.length, 0);

  assert.equal(Object.keys(savedLock.entries).length, 2);
  const sourceCommands = Object.values(savedLock.entries)
    .map((entry) => entry.sourceCommand)
    .sort();
  assert.deepEqual(sourceCommands, ["skillmd install", "skillmd install"]);
});

test("supports --global install scope and source command", async () => {
  let receivedLocation;
  let savedLocation;
  let capturedInstallScope = null;
  let capturedHomeDir = null;
  let savedLock;

  const { result, logs } = await captureConsole(() =>
    runInstallCommand(
      ["--global", "--agent-target", "claude", "--json"],
      baseOptions({
        homeDir: "/Users/tester",
        loadSkillsLock: async (_cwd, _deps, location) => {
          receivedLocation = location;
          return lockFile({});
        },
        saveSkillsLock: async (_cwd, lock, _deps, location) => {
          savedLock = lock;
          savedLocation = location;
        },
        installFromRegistry: async (input) => {
          capturedInstallScope = input.installScope;
          capturedHomeDir = input.homeDir;
          return {
            result: {
              skillId: input.skillSlug,
              username: input.username,
              skill: input.skillSlug,
              version: "1.1.0",
              digest: "sha256:new",
              sizeBytes: 6,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath: `/Users/tester/.claude/skills/${input.skillSlug}`,
              registryBaseUrl: "https://registry.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              source: "registry",
              agentTarget: input.selectedAgentTarget,
              installScope: input.installScope,
            },
            lockEntry: {
              skillId: input.skillSlug,
              username: input.username,
              skill: input.skillSlug,
              selectorSpec: input.selector.spec ?? input.selector.version,
              version: "1.1.0",
              digest: "sha256:new",
              sizeBytes: 6,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath: `/Users/tester/.claude/skills/${input.skillSlug}`,
              registryBaseUrl: "https://registry.example.com",
              downloadedFrom: "https://storage.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              sourceCommand: "skillmd install --global --agent-target claude",
              agentTarget: input.selectedAgentTarget,
            },
            warnings: [],
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(receivedLocation, { scope: "global", homeDir: "/Users/tester" });
  assert.deepEqual(savedLocation, { scope: "global", homeDir: "/Users/tester" });
  assert.equal(capturedInstallScope, "global");
  assert.equal(capturedHomeDir, "/Users/tester");

  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.installed.length, 1);
  assert.equal(payload.installed[0].agentTarget, "claude");
  const [savedEntry] = Object.values(savedLock.entries);
  assert.equal(savedEntry.sourceCommand, "skillmd install --global --agent-target claude");
});

test("install --json keeps warnings in payload without printing stderr warnings", async () => {
  const { result, logs, errors } = await captureConsole(() =>
    runInstallCommand(
      ["--json"],
      baseOptions({
        installFromRegistry: async (input) => ({
          ...(await baseOptions().installFromRegistry(input)),
          warnings: ["using cached metadata"],
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(errors.length, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.installed.length, 1);
  assert.match(payload.installed[0].reason, /using cached metadata/);
});

test("passes bare-vs-scoped skill identity through install workflow inputs", async () => {
  const captured = [];
  const { result } = await captureConsole(() =>
    runInstallCommand(
      ["--json"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: { agentTarget: "skillmd" },
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
            },
            {
              skillId: "@core/skill-b",
              username: "core",
              skillSlug: "skill-b",
              spec: "latest",
            },
          ],
        }),
        installFromRegistry: async (input) => {
          captured.push({
            skillSlug: input.skillSlug,
            username: input.username,
            preferBareSkillId: input.preferBareSkillId,
          });
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(captured, [
    { skillSlug: "skill-a", username: "", preferBareSkillId: true },
    { skillSlug: "skill-b", username: "core", preferBareSkillId: false },
  ]);
});

test("continues after dependency failure and exits non-zero", async () => {
  const { result, logs } = await captureConsole(() =>
    runInstallCommand(
      ["--json"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: {},
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
            },
            {
              skillId: "@team/skill-b",
              username: "team",
              skillSlug: "skill-b",
              spec: "latest",
            },
          ],
        }),
        installFromRegistry: async (input) => {
          if (input.skillSlug === "skill-a") {
            throw new UseApiError(404, "not_found", "skill not found");
          }
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );

  assert.equal(result, 1);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.installed.length, 1);
  assert.equal(payload.failed.length, 1);
  assert.match(payload.failed[0].reason, /skill not found/i);
});

test("global --agent-target accepts new builtin targets", async () => {
  const installTargets = [];
  const { result } = await captureConsole(() =>
    runInstallCommand(
      ["--agent-target", "meta"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: { agentTarget: "skillmd" },
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
            },
          ],
        }),
        installFromRegistry: async (input) => {
          installTargets.push(input.selectedAgentTarget);
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );
  assert.equal(result, 0);
  assert.deepEqual(installTargets, ["meta"]);
});

test("global --agent-target overrides dependency/default targets", async () => {
  const installTargets = [];
  const { result } = await captureConsole(() =>
    runInstallCommand(
      ["--agent-target", "gemini"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: { agentTarget: "skillmd" },
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
              agentTarget: "claude",
            },
          ],
        }),
        installFromRegistry: async (input) => {
          installTargets.push(input.selectedAgentTarget);
          return baseOptions().installFromRegistry(input);
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(installTargets, ["gemini"]);
});

test("prunes undeclared lock entries when --prune is set", async () => {
  let savedLock;
  const removedPaths = [];
  const { result, logs } = await captureConsole(() =>
    runInstallCommand(
      ["--prune", "--json"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: {},
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
            },
          ],
        }),
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "skill-a", resolvedVersion: "1.0.0" }),
            b: lockEntry({
              skillId: "skill-b",
              resolvedVersion: "1.0.0",
              installedPath: "/workspace/project/.agent/skills/skill-b",
            }),
          }),
        removePath: async (installedPath) => {
          removedPaths.push(installedPath);
        },
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(removedPaths, ["/workspace/project/.agent/skills/skill-b"]);

  const payload = JSON.parse(logs.join("\n"));
  assert.equal(Array.isArray(payload.pruned), true);
  assert.equal(payload.pruned.length, 1);
  assert.equal(payload.pruned[0].status, "pruned");
  assert.equal(Object.keys(savedLock.entries).length, 1);
});

test("rejects pruning non-canonical install paths from lockfile", async () => {
  let savedLock;
  const removedPaths = [];
  const { result, logs } = await captureConsole(() =>
    runInstallCommand(
      ["--prune", "--json"],
      baseOptions({
        loadSkillsManifest: async () => ({
          version: 1,
          defaults: {},
          dependencies: [
            {
              skillId: "skill-a",
              username: "",
              skillSlug: "skill-a",
              spec: "latest",
            },
          ],
        }),
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "skill-a", resolvedVersion: "1.0.0" }),
            b: lockEntry({
              skillId: "skill-b",
              resolvedVersion: "1.0.0",
              installedPath: "/tmp/unsafe-prune-target",
            }),
          }),
        removePath: async (installedPath) => {
          removedPaths.push(installedPath);
        },
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.deepEqual(removedPaths, []);

  const payload = JSON.parse(logs.join("\n"));
  assert.equal(Array.isArray(payload.pruned), true);
  assert.equal(payload.pruned.length, 1);
  assert.equal(payload.pruned[0].status, "failed");
  assert.match(payload.pruned[0].reason, /non-canonical install path/i);
  assert.equal(Object.keys(savedLock.entries).length, 2);
});

test("records pro-plan hint when install is denied for private skill access", async () => {
  const { UseApiError } = requireDist("lib/use/errors.js");
  const originalColumns = process.stdout.columns;
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "columns", { value: 240, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

  try {
    const { result, logs } = await captureConsole(() =>
      runInstallCommand(
        [],
        baseOptions({
          loadSkillsManifest: async () => ({
            version: 1,
            defaults: {},
            dependencies: [
              {
                skillId: "@stefdevscore/private-skill",
                spec: "latest",
              },
            ],
          }),
          installFromRegistry: async () => {
            throw new UseApiError(403, "forbidden", "private skill access is not allowed", {
              reason: "forbidden_plan",
            });
          },
        }),
      ),
    );

    assert.equal(result, 1);
    assert.match(logs.join("\n"), /private skill access is not allowed/i);
    assert.match(logs.join("\n"), /https:\/\/www\.skillmark[\s\S]*down\.com/);
  } finally {
    Object.defineProperty(process.stdout, "columns", {
      value: originalColumns,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
  }
});
