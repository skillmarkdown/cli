const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runAccountCommand } = requireDist("commands/account.js");
const { AccountApiError } = requireDist("lib/account/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
    },
    getAuthConfig: () => ({
      firebaseApiKey: "api-key",
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    promptForDeleteConfirmation: async () => "delete-account",
    deleteAccount: async () => ({
      status: "pending",
      deletionId: "user_account_deletion_uid123",
      uid: "uid123",
      username: "core",
    }),
    createAccountSupportRequest: async () => ({
      requestId: "sup_123",
      status: "received",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runAccountCommand(["bad"]));
  assert.equal(result, 1);
});

test("delete rejects wrong confirmation locally", async () => {
  const { result, errors } = await captureConsole(() =>
    runAccountCommand(["delete", "--confirm", "wrong"], baseOptions()),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /confirmation must exactly match 'delete-account'/);
});

test("delete prompts for confirmation when flag is omitted", async () => {
  let prompted = false;
  const { result, logs } = await captureConsole(() =>
    runAccountCommand(
      ["delete"],
      baseOptions({
        promptForDeleteConfirmation: async () => {
          prompted = true;
          return "delete-account";
        },
      }),
    ),
  );
  assert.equal(result, 0);
  assert.equal(prompted, true);
  assert.match(logs.join("\n"), /Account deletion requested for @core/);
  assert.match(logs.join("\n"), /Deletion ID: user_account_deletion_uid123/);
});

test("delete uses pending response in json mode", async () => {
  const { result, logs } = await captureConsole(() =>
    runAccountCommand(["delete", "--confirm", "delete-account", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.status, "pending");
  assert.equal(parsed.deletionId, "user_account_deletion_uid123");
});

test("support requires subject and message", async () => {
  const { result } = await captureConsole(() =>
    runAccountCommand(["support", "--subject", "Need help"], baseOptions()),
  );
  assert.equal(result, 1);
});

test("support submits exact payload", async () => {
  let captured = null;
  const { result, logs } = await captureConsole(() =>
    runAccountCommand(
      ["support", "--subject", "Need help", "--message", "Please assist"],
      baseOptions({
        createAccountSupportRequest: async (_baseUrl, _idToken, request) => {
          captured = request;
          return { requestId: "sup_456", status: "received" };
        },
      }),
    ),
  );
  assert.equal(result, 0);
  assert.deepEqual(captured, { subject: "Need help", message: "Please assist" });
  assert.match(logs.join("\n"), /Support request submitted/);
  assert.match(logs.join("\n"), /Request ID: sup_456/);
});

test("support auth failures use standard API handling", async () => {
  const { result, errors } = await captureConsole(() =>
    runAccountCommand(
      ["support", "--subject", "Need help", "--message", "Please assist"],
      baseOptions({
        createAccountSupportRequest: async () => {
          throw new AccountApiError(401, "unauthorized", "auth required");
        },
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /auth required/);
});
