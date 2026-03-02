const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { callWithReadTokenRetry, isReadTokenRetryableStatus } = requireDist(
  "lib/auth/read-token-retry.js",
);

test("isReadTokenRetryableStatus covers auth and not-found statuses", () => {
  assert.equal(isReadTokenRetryableStatus(401), true);
  assert.equal(isReadTokenRetryableStatus(403), true);
  assert.equal(isReadTokenRetryableStatus(404), true);
  assert.equal(isReadTokenRetryableStatus(400), false);
});

test("callWithReadTokenRetry retries once with resolved token", async () => {
  let callCount = 0;
  const result = await callWithReadTokenRetry({
    request: async (idToken) => {
      callCount += 1;
      if (!idToken) {
        const error = new Error("missing token");
        error.status = 404;
        throw error;
      }
      return `ok:${idToken}`;
    },
    resolveReadIdToken: async () => "id_token_123",
    shouldRetry: (error) => error && error.status === 404,
  });

  assert.equal(callCount, 2);
  assert.equal(result.idToken, "id_token_123");
  assert.equal(result.result, "ok:id_token_123");
});

test("callWithReadTokenRetry does not resolve token when token already provided", async () => {
  let resolveCalls = 0;

  await assert.rejects(
    callWithReadTokenRetry({
      idToken: "preset_token",
      request: async () => {
        const error = new Error("still unauthorized");
        error.status = 401;
        throw error;
      },
      resolveReadIdToken: async () => {
        resolveCalls += 1;
        return "new_token";
      },
      shouldRetry: () => true,
    }),
    /still unauthorized/i,
  );

  assert.equal(resolveCalls, 0);
});

test("callWithReadTokenRetry rethrows original error when token resolution returns null", async () => {
  let requestCalls = 0;
  let resolveCalls = 0;
  const originalError = new Error("not found");
  originalError.status = 404;

  await assert.rejects(
    callWithReadTokenRetry({
      request: async () => {
        requestCalls += 1;
        throw originalError;
      },
      resolveReadIdToken: async () => {
        resolveCalls += 1;
        return null;
      },
      shouldRetry: (error) => error && error.status === 404,
    }),
    (error) => {
      assert.equal(error, originalError);
      return true;
    },
  );

  assert.equal(requestCalls, 1);
  assert.equal(resolveCalls, 1);
});
