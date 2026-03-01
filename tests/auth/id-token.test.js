const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  mockJsonResponse,
  mockTextResponse,
  withMockedFetch,
} = require("../helpers/fetch-test-utils.js");

const { exchangeRefreshTokenForIdToken } = requireDist("lib/auth/id-token.js");

test("exchangeRefreshTokenForIdToken returns id token payload", async () => {
  const result = await withMockedFetch(
    async (input) => {
      assert.match(String(input), /securetoken\.googleapis\.com/);
      return mockJsonResponse(200, {
        id_token: "id-token",
        user_id: "uid-1",
        expires_in: "3600",
      });
    },
    () => exchangeRefreshTokenForIdToken("apikey", "refresh-token"),
  );

  assert.deepEqual(result, {
    idToken: "id-token",
    userId: "uid-1",
    expiresInSeconds: 3600,
  });
});

test("exchangeRefreshTokenForIdToken rejects non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(502, "not-json"),
    async () => {
      await assert.rejects(exchangeRefreshTokenForIdToken("apikey", "refresh-token"), /non-JSON/);
    },
  );
});

test("exchangeRefreshTokenForIdToken reports API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(400, {
        error: { message: "INVALID_REFRESH_TOKEN" },
      }),
    async () => {
      await assert.rejects(
        exchangeRefreshTokenForIdToken("apikey", "refresh-token"),
        /INVALID_REFRESH_TOKEN/,
      );
    },
  );
});
