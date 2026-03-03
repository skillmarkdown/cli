const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runDeprecateCommand } = requireDist("commands/deprecate.js");
const { DeprecateApiError } = requireDist("lib/deprecate/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_GITHUB_CLIENT_ID: "github-client-id",
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
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown-development",
    }),
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    deprecateVersions: async () => ({
      status: "updated",
      range: "^1.2.0",
      affectedVersions: ["1.2.0", "1.2.1"],
      message: "Use 2.x",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runDeprecateCommand(["@core/test-skill@1.2.3"]));
  assert.equal(result, 1);
});

test("fails when not logged in", async () => {
  const { result, errors } = await captureConsole(() =>
    runDeprecateCommand(
      ["@core/test-skill@^1.2.0", "--message", "Use 2.x"],
      baseOptions({ readSession: () => null }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("deprecates versions for owner skill", async () => {
  let capturedRequest = null;
  const { result, logs } = await captureConsole(() =>
    runDeprecateCommand(
      ["@core/test-skill@^1.2.0", "--message", "Use 2.x"],
      baseOptions({
        deprecateVersions: async (_baseUrl, _idToken, request) => {
          capturedRequest = request;
          return {
            status: "updated",
            range: "^1.2.0",
            affectedVersions: ["1.2.0", "1.2.1"],
            message: "Use 2.x",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(capturedRequest, {
    ownerSlug: "core",
    skillSlug: "test-skill",
    range: "^1.2.0",
    message: "Use 2.x",
  });
  assert.match(logs.join("\n"), /Deprecated 2 version\(s\) for @core\/test-skill/i);
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runDeprecateCommand(
      ["@core/test-skill@^1.2.0", "--message", "Use 2.x", "--json"],
      baseOptions(),
    ),
  );

  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.status, "updated");
});

test("maps deprecate API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runDeprecateCommand(
      ["@core/test-skill@^1.2.0", "--message", "Use 2.x"],
      baseOptions({
        deprecateVersions: async () => {
          throw new DeprecateApiError(400, "invalid_request", "range invalid");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /range invalid/);
});
