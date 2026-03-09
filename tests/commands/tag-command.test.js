const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runTagCommand } = requireDist("commands/tag.js");
const { TagApiError } = requireDist("lib/tag/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
    },
    getConfig: () => ({
      firebaseApiKey: "api-key",
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    readSession: () => ({
      provider: "email",
      uid: "uid-1",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown-development",
    }),
    resolveReadIdToken: async () => null,
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      username: "core",
      email: "core@example.com",
      projectId: "skillmarkdown-development",
      authType: "firebase",
      scope: "admin",
      plan: "pro",
      entitlements: { privateSkills: true },
      teams: [],
    }),
    listDistTags: async () => ({
      owner: "@core",
      username: "core",
      skill: "publish-skill",
      distTags: {
        latest: "1.0.0",
      },
      updatedAt: "2026-03-03T12:00:00.000Z",
    }),
    setDistTag: async () => ({
      status: "updated",
      tag: "beta",
      version: "1.2.3",
      distTags: {
        latest: "1.2.2",
        beta: "1.2.3",
      },
    }),
    removeDistTag: async () => ({
      status: "deleted",
      tag: "beta",
      distTags: {
        latest: "1.2.2",
      },
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runTagCommand(["ls"], baseOptions()));
  assert.equal(result, 1);
});

test("fails with usage when tag resembles semver range", async () => {
  const { result } = await captureConsole(() =>
    runTagCommand(["add", "@core/publish-skill@1.2.3", "1.2.x"], baseOptions()),
  );

  assert.equal(result, 1);
});

test("lists dist-tags in human output", async () => {
  const { result, logs } = await captureConsole(() =>
    runTagCommand(["ls", "@core/publish-skill"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Skill: @core\/publish-skill/);
  assert.match(logs.join("\n"), /latest: 1.0.0/);
});

test("lists dist-tags in json output", async () => {
  const { result, logs } = await captureConsole(() =>
    runTagCommand(["ls", "@core/publish-skill", "--json"], baseOptions()),
  );

  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.skill, "publish-skill");
  assert.equal(payload.distTags.latest, "1.0.0");
});

test("add fails when not logged in", async () => {
  const { result, errors } = await captureConsole(() =>
    runTagCommand(
      ["add", "@core/publish-skill@1.2.3", "beta"],
      baseOptions({
        readSession: () => null,
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("add fails on project mismatch with reauth guidance", async () => {
  const { result, errors } = await captureConsole(() =>
    runTagCommand(
      ["add", "@core/publish-skill@1.2.3", "beta"],
      baseOptions({
        readSession: () => ({
          provider: "email",
          uid: "uid-1",
          refreshToken: "refresh-token",
          projectId: "skillmarkdown",
        }),
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /login --reauth/);
});

test("add updates tag for owner skill", async () => {
  let capturedRequest = null;
  const { result, logs } = await captureConsole(() =>
    runTagCommand(
      ["add", "@core/publish-skill@1.2.3", "beta"],
      baseOptions({
        setDistTag: async (_baseUrl, _idToken, request) => {
          capturedRequest = request;
          return {
            status: "updated",
            tag: "beta",
            version: "1.2.3",
            distTags: {
              latest: "1.2.2",
              beta: "1.2.3",
            },
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(capturedRequest.skillSlug, "publish-skill");
  assert.equal(capturedRequest.version, "1.2.3");
  assert.match(logs.join("\n"), /Updated dist-tag beta -> 1.2.3/);
});

test("rm deletes tag for owner skill", async () => {
  const { result, logs } = await captureConsole(() =>
    runTagCommand(["rm", "@core/publish-skill", "beta"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Removed dist-tag beta/);
});

test("maps tag API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runTagCommand(
      ["add", "@core/publish-skill@1.2.3", "beta"],
      baseOptions({
        setDistTag: async () => {
          throw new TagApiError(404, "not_found", "missing");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /missing/);
});
