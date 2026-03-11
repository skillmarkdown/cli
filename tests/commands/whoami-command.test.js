const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");
const { makeRegistryEnv } = require("../helpers/auth-fixtures.js");

const { runWhoamiCommand } = requireDist("commands/whoami.js");
const { WhoamiApiError } = requireDist("lib/whoami/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: makeRegistryEnv(),
    getConfig: () => ({
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    resolveReadIdToken: async () => "id-token",
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      username: "core",
      email: "core@example.com",
      projectId: "skillmarkdown-development",
      authType: "firebase",
      scope: "admin",
      plan: "pro",
      organizations: [
        {
          slug: "facebook",
          owner: "@facebook",
          role: "admin",
        },
      ],
      organizationTeams: [
        {
          organizationSlug: "facebook",
          teamSlug: "core",
        },
      ],
      entitlements: {
        canUsePrivateSkills: true,
        canPublishPrivateSkills: true,
      },
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
  assert.match(logs.join("\n"), /Auth: account session/);
  assert.match(logs.join("\n"), /Plan: pro/);
  assert.match(logs.join("\n"), /Organizations:/);
  assert.match(logs.join("\n"), /@facebook role=admin/);
  assert.match(logs.join("\n"), /Teams:/);
  assert.match(logs.join("\n"), /@facebook: core/);
  assert.doesNotMatch(logs.join("\n"), /Entitlements:/);
});

test("prints json payload with --json", async () => {
  const { result, logs } = await captureConsole(() => runWhoamiCommand(["--json"], baseOptions()));

  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.uid, "uid-1");
  assert.equal(payload.owner, "@core");
  assert.equal(payload.organizations[0].slug, "facebook");
  assert.equal(payload.organizationTeams[0].teamSlug, "core");
});

test("whoami preserves exact auth failure wording", async () => {
  const { result, errors } = await captureConsole(() =>
    runWhoamiCommand(
      [],
      baseOptions({
        resolveReadIdToken: async () => null,
      }),
    ),
  );

  assert.equal(result, 1);
  assert.deepEqual(errors, ["skillmd whoami: not logged in. Run 'skillmd login' first."]);
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

test("prints free plan without entitlements in human format", async () => {
  const { result, logs } = await captureConsole(() =>
    runWhoamiCommand(
      [],
      baseOptions({
        getWhoami: async () => ({
          uid: "uid-1",
          owner: "@core",
          username: "core",
          email: "core@example.com",
          projectId: "skillmarkdown-development",
          authType: "firebase",
          scope: "admin",
          plan: "free",
          entitlements: {
            canUsePrivateSkills: false,
            canPublishPrivateSkills: false,
          },
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Plan: free/);
  assert.doesNotMatch(logs.join("\n"), /Entitlements:/);
});
