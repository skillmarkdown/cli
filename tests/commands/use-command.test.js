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
    }),
    resolveVersion: async () => ({
      owner: "@stefdevscore",
      ownerLogin: "stefdevscore",
      skill: "test-skill",
      channel: "latest",
      version: "1.2.3",
    }),
    getArtifactDescriptor: async () => ({
      owner: "@stefdevscore",
      ownerLogin: "stefdevscore",
      skill: "test-skill",
      version: "1.2.3",
      digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      sizeBytes: 5,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      yanked: false,
      yankedAt: null,
      yankedReason: null,
      downloadUrl: "https://storage.example.com/object",
      downloadExpiresAt: "2026-03-02T12:40:00.000Z",
    }),
    downloadArtifact: async () => ({
      bytes: Buffer.from("hello", "utf8"),
      downloadedFrom: "https://storage.example.com/object",
      contentType: "application/vnd.skillmarkdown.skill.v1+tar",
    }),
    installArtifact: async () => {},
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runUseCommand([]);
  assert.equal(exitCode, 1);
});

test("installs with default latest selector and prints human output", async () => {
  let resolvedChannel;
  let installInput;
  const { result, logs } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        resolveVersion: async (_baseUrl, _owner, _skill, channel) => {
          resolvedChannel = channel;
          return {
            owner: "@stefdevscore",
            ownerLogin: "stefdevscore",
            skill: "test-skill",
            channel: "latest",
            version: "1.2.3",
          };
        },
        installArtifact: async (input) => {
          installInput = input;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(resolvedChannel, "latest");
  assert.match(logs.join("\n"), /Installed @stefdevscore\/test-skill@1.2.3/);
  assert.match(logs.join("\n"), /Next: skillmd history @stefdevscore\/test-skill --limit 20/);
  assert.ok(
    installInput.targetPath.endsWith(
      "/.agent/skills/registry.skillmarkdown.com/stefdevscore/test-skill",
    ),
  );
});

test("falls back to beta when latest channel is not set by default", async () => {
  const resolveCalls = [];
  let installInput;

  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        resolveVersion: async (_baseUrl, _owner, _skill, channel) => {
          resolveCalls.push(channel);
          if (channel === "latest") {
            throw new UseApiError(404, "invalid_request", "channel not set for skill");
          }

          return {
            owner: "@stefdevscore",
            ownerLogin: "stefdevscore",
            skill: "test-skill",
            channel: "beta",
            version: "1.2.3-beta.1",
          };
        },
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          ownerLogin: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3-beta.1",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          yanked: false,
          yankedAt: null,
          yankedReason: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
        installArtifact: async (input) => {
          installInput = input;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(resolveCalls, ["latest", "beta"]);
  assert.equal(
    installInput.metadata.sourceCommand,
    "skillmd use @stefdevscore/test-skill --channel beta",
  );
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

test("blocks yanked versions by default", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--version", "1.2.3"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          ownerLogin: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          yanked: true,
          yankedAt: "2026-03-02T10:00:00.000Z",
          yankedReason: "security issue",
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /yanked/i);
});

test("allows yanked versions with --allow-yanked", async () => {
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--version", "1.2.3", "--allow-yanked"],
      baseOptions({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          ownerLogin: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          yanked: true,
          yankedAt: "2026-03-02T10:00:00.000Z",
          yankedReason: "security issue",
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
});

test("maps use API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        resolveVersion: async () => {
          throw new UseApiError(404, "invalid_request", "skill not found");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skill not found/);
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

test("passes --channel beta to resolve and records sourceCommand", async () => {
  let resolvedChannel;
  let installInput;
  const { result } = await captureConsole(() =>
    runUseCommand(
      ["@stefdevscore/test-skill", "--channel", "beta"],
      baseOptions({
        resolveVersion: async (_baseUrl, _owner, _skill, channel) => {
          resolvedChannel = channel;
          return {
            owner: "@stefdevscore",
            ownerLogin: "stefdevscore",
            skill: "test-skill",
            channel: "beta",
            version: "1.2.3-beta.1",
          };
        },
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          ownerLogin: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3-beta.1",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          yanked: false,
          yankedAt: null,
          yankedReason: null,
          downloadUrl: "https://storage.example.com/object",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
        installArtifact: async (input) => {
          installInput = input;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(resolvedChannel, "beta");
  assert.equal(
    installInput.metadata.sourceCommand,
    "skillmd use @stefdevscore/test-skill --channel beta",
  );
});
