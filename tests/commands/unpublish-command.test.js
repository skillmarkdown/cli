const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");
const {
  makeEmailSession,
  makeRegistryConfig,
  makeRegistryEnv,
  makeWhoamiOwner,
} = require("../helpers/auth-fixtures.js");

const { runUnpublishCommand } = requireDist("commands/unpublish.js");
const { UnpublishApiError } = requireDist("lib/unpublish/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: makeRegistryEnv(),
    getConfig: () => makeRegistryConfig(),
    readSession: () => makeEmailSession(),
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => makeWhoamiOwner(),
    unpublishVersion: async () => ({
      status: "unpublished",
      version: "1.2.3",
      tombstoned: true,
      removedTags: ["latest"],
      distTags: { beta: "2.0.0-beta.1" },
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runUnpublishCommand(["@core/test-skill"]));
  assert.equal(result, 1);
});

test("fails when not logged in", async () => {
  const { result, errors } = await captureConsole(() =>
    runUnpublishCommand(["@core/test-skill@1.2.3"], baseOptions({ readSession: () => null })),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("unpublishes version for owner skill", async () => {
  let capturedRequest = null;
  const { result, logs } = await captureConsole(() =>
    runUnpublishCommand(
      ["@core/test-skill@1.2.3"],
      baseOptions({
        unpublishVersion: async (_baseUrl, _idToken, request) => {
          capturedRequest = request;
          return {
            status: "unpublished",
            version: "1.2.3",
            tombstoned: true,
            removedTags: ["latest"],
            distTags: { beta: "2.0.0-beta.1" },
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(capturedRequest, {
    username: "core",
    skillSlug: "test-skill",
    version: "1.2.3",
  });
  assert.match(logs.join("\n"), /Unpublished @core\/test-skill@1.2.3/);
});

test("unpublish preserves exact human output wording", async () => {
  const { result, logs } = await captureConsole(() =>
    runUnpublishCommand(["@core/test-skill@1.2.3"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.deepEqual(logs, ["Unpublished @core/test-skill@1.2.3. Removed tags: latest."]);
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runUnpublishCommand(["@core/test-skill@1.2.3", "--json"], baseOptions()),
  );

  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.status, "unpublished");
});

test("maps unpublish API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runUnpublishCommand(
      ["@core/test-skill@1.2.3"],
      baseOptions({
        unpublishVersion: async () => {
          throw new UnpublishApiError(409, "unpublish_denied", "policy window elapsed");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /policy window elapsed/);
});
