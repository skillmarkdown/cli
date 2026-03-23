const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runTokenCommand } = requireDist("commands/token.js");
const { TokenApiError } = requireDist("lib/token/errors.js");

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
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    createToken: async () => ({
      tokenId: "tok_abc123abc123abc123abc123",
      token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      name: "ci",
      scope: "publish",
      createdAt: "2026-03-03T00:00:00.000Z",
      expiresAt: "2026-04-02T00:00:00.000Z",
    }),
    listTokens: async () => ({
      tokens: [
        {
          tokenId: "tok_abc123abc123abc123abc123",
          name: "ci",
          scope: "publish",
          createdAt: "2026-03-03T00:00:00.000Z",
          expiresAt: "2026-04-02T00:00:00.000Z",
        },
      ],
    }),
    revokeToken: async () => ({
      status: "revoked",
      tokenId: "tok_abc123abc123abc123abc123",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runTokenCommand(["bad"]));
  assert.equal(result, 1);
});

test("fails when no auth path is available", async () => {
  const { result, errors } = await captureConsole(() =>
    runTokenCommand(
      ["ls"],
      baseOptions({
        readSession: () => null,
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("lists tokens in json", async () => {
  const { result, logs } = await captureConsole(() =>
    runTokenCommand(["ls", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.tokens.length, 1);
});

test("adds token using configured auth token and no session", async () => {
  let exchangeCalled = false;
  let capturedToken = null;
  const { result, logs } = await captureConsole(() =>
    runTokenCommand(
      ["add", "ci", "--scope", "admin", "--days", "7"],
      baseOptions({
        env: {
          SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
          SKILLMD_FIREBASE_API_KEY: "api-key",
          SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
          SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
          SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
        },
        readSession: () => null,
        exchangeRefreshToken: async () => {
          exchangeCalled = true;
          return {
            idToken: "id-token",
            userId: "uid-1",
            expiresInSeconds: 3600,
          };
        },
        createToken: async (_baseUrl, idToken) => {
          capturedToken = idToken;
          return {
            tokenId: "tok_abc123abc123abc123abc123",
            token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
            name: "ci",
            scope: "admin",
            createdAt: "2026-03-03T00:00:00.000Z",
            expiresAt: "2026-03-10T00:00:00.000Z",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(exchangeCalled, false);
  assert.equal(capturedToken, "skmd_dev_tok_abc123abc123abc123abc123.secret");
  assert.match(logs.join("\n"), /Created token tok_abc123abc123abc123abc123/);
});

test("revokes token", async () => {
  const { result, logs } = await captureConsole(() =>
    runTokenCommand(["rm", "tok_abc123abc123abc123abc123"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Revoked token tok_abc123abc123abc123abc123/);
});

test("maps token API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runTokenCommand(
      ["ls"],
      baseOptions({
        listTokens: async () => {
          throw new TokenApiError(403, "forbidden", "insufficient token scope");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /insufficient token scope/);
});

test("prints request id and scope hint for token API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runTokenCommand(
      ["ls"],
      baseOptions({
        listTokens: async () => {
          throw new TokenApiError(403, "forbidden", "insufficient token scope", {
            reason: "forbidden_scope",
            requestId: "req_tok_123",
          });
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /request req_tok_123/);
  assert.match(errors.join("\n"), /use a token with the required scope/i);
});

test("surfaces token quota denials cleanly", async () => {
  const { result, errors } = await captureConsole(() =>
    runTokenCommand(
      ["add", "ci"],
      baseOptions({
        createToken: async () => {
          throw new TokenApiError(
            403,
            "plan_limit_exceeded",
            "free accounts can create up to 20 access tokens",
            {
              resource: "tokens",
              currentCount: 20,
              maxAllowed: 20,
              plan: "free",
            },
          );
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /free accounts can create up to 20 access tokens/);
});
