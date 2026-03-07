const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runInstallCommand } = requireDist("commands/install.js");
const { UseApiError } = requireDist("lib/use/errors.js");

function lockEntry(overrides = {}) {
  const skillId = overrides.skillId ?? "@owner/skill-a";
  const skill = skillId.split("/")[1];
  return {
    skillId,
    ownerLogin: "owner",
    skill,
    selectorSpec: "latest",
    resolvedVersion: "1.0.0",
    digest: "sha256:old",
    sizeBytes: 5,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    installedPath:
      overrides.installedPath ??
      `/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/${skill}`,
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
          skillId: "@owner/skill-a",
          ownerSlug: "owner",
          skillSlug: "skill-a",
          spec: "latest",
        },
      ],
    }),
    loadSkillsLock: async () =>
      lockFile({
        a: lockEntry({ skillId: "@owner/skill-a", resolvedVersion: "1.0.0" }),
      }),
    saveSkillsLock: async () => {},
    installFromRegistry: async (input) => ({
      result: {
        skillId: `@${input.ownerSlug}/${input.skillSlug}`,
        ownerLogin: input.ownerSlug,
        skill: input.skillSlug,
        version: "1.1.0",
        digest: "sha256:new",
        sizeBytes: 6,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath:
          `/workspace/project/.agent/skills/registry.skillmarkdown.com/` +
          `${input.ownerSlug}/${input.skillSlug}`,
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T12:34:56.000Z",
        source: "registry",
        agentTarget: input.selectedAgentTarget,
      },
      lockEntry: {
        skillId: `@${input.ownerSlug}/${input.skillSlug}`,
        ownerLogin: input.ownerSlug,
        skill: input.skillSlug,
        selectorSpec: input.selector.spec ?? input.selector.version,
        version: "1.1.0",
        digest: "sha256:new",
        sizeBytes: 6,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath:
          `/workspace/project/.agent/skills/registry.skillmarkdown.com/` +
          `${input.ownerSlug}/${input.skillSlug}`,
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
  const exitCode = await runInstallCommand(["@owner/skill"]);
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
              skillId: "@owner/skill-a",
              ownerSlug: "owner",
              skillSlug: "skill-a",
              spec: "latest",
            },
            {
              skillId: "@owner/skill-b",
              ownerSlug: "owner",
              skillSlug: "skill-b",
              spec: "^1.2.0",
              agentTarget: "claude",
            },
          ],
        }),
        installFromRegistry: async (input) => {
          installCalls.push(`${input.ownerSlug}/${input.skillSlug}:${input.selectedAgentTarget}`);
          return baseOptions().installFromRegistry(input);
        },
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(installCalls, ["owner/skill-a:skillmd", "owner/skill-b:claude"]);

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
              skillId: "@owner/skill-a",
              ownerSlug: "owner",
              skillSlug: "skill-a",
              spec: "latest",
            },
            {
              skillId: "@owner/skill-b",
              ownerSlug: "owner",
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
              skillId: "@owner/skill-a",
              ownerSlug: "owner",
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
              skillId: "@owner/skill-a",
              ownerSlug: "owner",
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
              skillId: "@owner/skill-a",
              ownerSlug: "owner",
              skillSlug: "skill-a",
              spec: "latest",
            },
          ],
        }),
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@owner/skill-a", resolvedVersion: "1.0.0" }),
            b: lockEntry({
              skillId: "@owner/skill-b",
              resolvedVersion: "1.0.0",
              installedPath:
                "/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/skill-b",
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
  assert.deepEqual(removedPaths, [
    "/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/skill-b",
  ]);

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
              skillId: "@owner/skill-a",
              ownerSlug: "owner",
              skillSlug: "skill-a",
              spec: "latest",
            },
          ],
        }),
        loadSkillsLock: async () =>
          lockFile({
            a: lockEntry({ skillId: "@owner/skill-a", resolvedVersion: "1.0.0" }),
            b: lockEntry({
              skillId: "@owner/skill-b",
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
