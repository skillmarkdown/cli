const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runUseCommand } = requireDist("commands/use.js");
const { UseApiError } = requireDist("lib/use/errors.js");

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
    resolveVersion: async () => ({
      owner: "@stefdevscore",
      username: "stefdevscore",
      skill: "test-skill",
      spec: "latest",
      version: "1.2.3",
    }),
    getArtifactDescriptor: async () => ({
      owner: "@stefdevscore",
      username: "stefdevscore",
      skill: "test-skill",
      version: "1.2.3",
      digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      sizeBytes: 5,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      deprecated: false,
      deprecatedAt: null,
      deprecatedMessage: null,
      downloadUrl: "https://storage.example.com/object",
      downloadExpiresAt: "2026-03-02T12:40:00.000Z",
    }),
    downloadArtifact: async () => ({
      bytes: Buffer.from("hello", "utf8"),
      downloadedFrom: "https://storage.example.com/object",
      contentType: "application/vnd.skillmarkdown.skill.v1+tar",
    }),
    installArtifact: async () => {},
    resolveReadIdToken: async () => null,
    loadSkillsLock: async () => ({
      lockfileVersion: 1,
      generatedAt: "2026-03-02T00:00:00.000Z",
      entries: {},
    }),
    saveSkillsLock: async () => {},
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runUseCommand([]);
  assert.equal(exitCode, 1);
});

test("installs with default latest spec selector and updates lock", async () => {
  let resolvedSpec;
  let savedLock;
  const { result, logs } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        resolveVersion: async (_baseUrl, _owner, _skill, spec) => {
          resolvedSpec = spec;
          return {
            owner: "@stefdevscore",
            username: "stefdevscore",
            skill: "test-skill",
            spec: "latest",
            version: "1.2.3",
          };
        },
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(resolvedSpec, "latest");
  assert.match(logs.join("\n"), /Installed @stefdevscore\/test-skill@1.2.3/);
  assert.equal(Object.keys(savedLock.entries).length, 1);
  const entry = Object.values(savedLock.entries)[0];
  assert.equal(entry.selectorSpec, "latest");
  assert.equal(entry.resolvedVersion, "1.2.3");
});

test("uses descriptor agent target when flag is omitted", async () => {
  let installInput;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
          agentTarget: "claude",
        }),
        installArtifact: async (input) => {
          installInput = input;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.ok(installInput.targetPath.includes("/.claude/skills/registry.skillmarkdown.com/"));
});

test("explicit --agent-target overrides descriptor target", async () => {
  let installInput;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--agent-target", "gemini"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
          agentTarget: "claude",
        }),
        installArtifact: async (input) => {
          installInput = input;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.ok(installInput.targetPath.includes("/.gemini/skills/registry.skillmarkdown.com/"));
});

test("save persists explicitly selected agent target", async () => {
  let savedManifest;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--agent-target", "gemini", "--save"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
          agentTarget: "claude",
        }),
        loadSkillsManifestOrEmpty: async () => ({
          version: 1,
          defaults: {},
          dependencies: [],
        }),
        saveSkillsManifest: async (_cwd, manifest) => {
          savedManifest = manifest;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(savedManifest.dependencies.length, 1);
  assert.equal(savedManifest.dependencies[0].skillId, "@stefdevscore/test-skill");
  assert.equal(savedManifest.dependencies[0].agentTarget, "gemini");
  assert.equal(savedManifest.dependencies[0].spec, "latest");
});

test("save omits agent target when resolved target is the default", async () => {
  let savedManifest;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--save"],
      baseOptions({
        loadSkillsManifestOrEmpty: async () => ({
          version: 1,
          defaults: {},
          dependencies: [],
        }),
        saveSkillsManifest: async (_cwd, manifest) => {
          savedManifest = manifest;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(savedManifest.dependencies.length, 1);
  assert.equal(savedManifest.dependencies[0].skillId, "@stefdevscore/test-skill");
  assert.equal(savedManifest.dependencies[0].agentTarget, undefined);
  assert.equal(savedManifest.dependencies[0].spec, "latest");
});

test("save persists descriptor agent target when it is non-default", async () => {
  let savedManifest;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--save"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
          agentTarget: "claude",
        }),
        loadSkillsManifestOrEmpty: async () => ({
          version: 1,
          defaults: {},
          dependencies: [],
        }),
        saveSkillsManifest: async (_cwd, manifest) => {
          savedManifest = manifest;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(savedManifest.dependencies.length, 1);
  assert.equal(savedManifest.dependencies[0].agentTarget, "claude");
});

test("supports explicit --spec selector", async () => {
  let resolvedSpec;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--spec", "^1.2.0"],
      baseOptions({
        resolveVersion: async (_baseUrl, _owner, _skill, spec) => {
          resolvedSpec = spec;
          return {
            owner: "@stefdevscore",
            username: "stefdevscore",
            skill: "test-skill",
            spec,
            version: "1.2.3",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(resolvedSpec, "^1.2.0");
});

test("uses explicit --version without calling resolve endpoint", async () => {
  let resolveCalled = false;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--version", "1.2.3"],
      baseOptions({
        resolveVersion: async () => {
          resolveCalled = true;
          throw new Error("should not be called");
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(resolveCalled, false);
});

test("retries resolve with read token when first attempt returns not found", async () => {
  const resolveCalls = [];
  let tokenResolutionCount = 0;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        resolveReadIdToken: async () => {
          tokenResolutionCount += 1;
          return "id_token_123";
        },
        resolveVersion: async (_baseUrl, _owner, _skill, _spec, options) => {
          resolveCalls.push(options?.idToken ?? null);
          if (!options?.idToken) {
            throw new UseApiError(404, "not_found", "skill not found");
          }

          return {
            owner: "@stefdevscore",
            username: "stefdevscore",
            skill: "test-skill",
            spec: "latest",
            version: "1.2.3",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(resolveCalls, [null, "id_token_123"]);
  assert.equal(tokenResolutionCount, 1);
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runUseCommand(["@stefdevscore/test-skill", "--json"], baseOptions()),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.skillId, "@stefdevscore/test-skill");
  assert.equal(parsed.version, "1.2.3");
});

test("prints warnings in json output", async () => {
  const { result, logs } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--version", "1.2.3", "--json"],
      baseOptions({
        getConfig: () => ({
          firebaseProjectId: "skillmarkdown",
          registryBaseUrl: "https://registry.skillmarkdown.com",
          requestTimeoutMs: 10000,
          defaultAgentTarget: "skillmd",
        }),
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: true,
          deprecatedAt: "2026-03-02T10:00:00.000Z",
          deprecatedMessage: "security issue",
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.warnings.length, 2);
  assert.match(parsed.warnings[0], /using production registry/i);
  assert.match(parsed.warnings[1], /deprecated version 1.2.3/i);
});

test("warns when use command targets production registry", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        getConfig: () => ({
          firebaseProjectId: "skillmarkdown",
          registryBaseUrl: "https://registry.skillmarkdown.com",
          requestTimeoutMs: 10000,
          defaultAgentTarget: "skillmd",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(errors.join("\n"), /using production registry/i);
});

test("warns when selected version is deprecated and still installs", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--version", "1.2.3"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: true,
          deprecatedAt: "2026-03-02T10:00:00.000Z",
          deprecatedMessage: "security issue",
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(errors.join("\n"), /deprecated version 1.2.3/i);
});

test("stores canonical source command with resolved non-default agent target", async () => {
  let savedLock;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@StefDevScore/Test-Skill", "--spec", "beta"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
          agentTarget: "claude",
        }),
        saveSkillsLock: async (_cwd, lock) => {
          savedLock = lock;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  const entry = Object.values(savedLock.entries)[0];
  assert.equal(entry.skillId, "@stefdevscore/test-skill");
  assert.equal(
    entry.sourceCommand,
    "skillmd use @stefdevscore/test-skill --spec beta --agent-target claude",
  );
});

test("does not call manifest helpers unless --save is passed", async () => {
  let loadManifestCalled = false;
  let saveManifestCalled = false;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        loadSkillsManifestOrEmpty: async () => {
          loadManifestCalled = true;
          return { version: 1, defaults: {}, dependencies: [] };
        },
        saveSkillsManifest: async () => {
          saveManifestCalled = true;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(loadManifestCalled, false);
  assert.equal(saveManifestCalled, false);
});

test("maps use API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        resolveVersion: async () => {
          throw new UseApiError(404, "not_found", "skill not found");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skill not found/);
});

test("fails for invalid skill ids", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(["not-a-skill-id"], baseOptions()),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skill id must be in the form/i);
});

test("prefixes unexpected errors with command name", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        saveSkillsLock: async () => {
          throw new Error("disk is full");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skillmd use: disk is full/i);
});

test("prints pro-plan hint for private skill install denial", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        getArtifactDescriptor: async () => {
          const { UseApiError } = requireDist("lib/use/errors.js");
          throw new UseApiError(403, "forbidden", "private skill access is not allowed", {
            reason: "forbidden_plan",
          });
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /private skill access is not allowed/i);
  assert.match(errors.join("\n"), /private skills require a Pro plan/i);
});
