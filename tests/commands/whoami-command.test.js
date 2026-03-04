const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runWhoamiCommand } = requireDist("commands/whoami.js");
const { WhoamiApiError } = requireDist("lib/whoami/errors.js");

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
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    resolveReadIdToken: async () => "id-token",
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      ownerLogin: "core",
      email: "core@example.com",
      projectId: "skillmarkdown-development",
      authType: "firebase",
      scope: "admin",
      plan: "teams",
      entitlements: {
        canUsePrivateSkills: true,
        canPublishPrivateSkills: true,
      },
      teams: [{ team: "core-team", role: "owner" }],
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runWhoamiCommand(["--bad"]));
  assert.equal(result, 1);
});

test("fails when no auth token is available", async () => {
  const { result, errors } = await captureConsole(() =>
    runWhoamiCommand(
      [],
      baseOptions({
        resolveReadIdToken: async () => null,
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("prints whoami payload in human format", async () => {
  const { result, logs } = await captureConsole(() => runWhoamiCommand([], baseOptions()));
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Owner: @core \(core\)/);
  assert.match(logs.join("\n"), /Auth: firebase \(admin\)/);
  assert.match(logs.join("\n"), /Plan: teams/);
  assert.match(logs.join("\n"), /Entitlements: /);
  assert.match(logs.join("\n"), /Teams: 1/);
});

test("prints json payload with --json", async () => {
  const { result, logs } = await captureConsole(() => runWhoamiCommand(["--json"], baseOptions()));

  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.uid, "uid-1");
  assert.equal(payload.owner, "@core");
});

test("maps whoami API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runWhoamiCommand(
      [],
      baseOptions({
        getWhoami: async () => {
          throw new WhoamiApiError(401, "unauthorized", "invalid token");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /invalid token/);
});
