const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  mockJsonResponse,
  mockTextResponse,
  withMockedFetch,
} = require("../helpers/fetch-test-utils.js");

const { signInWithEmailAndPassword, verifyFirebaseRefreshToken } = requireDist(
  "lib/auth/firebase-auth.js",
);

test("signInWithEmailAndPassword returns mapped Firebase session", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        localId: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh-1",
      }),
    async () => {
      await assert.doesNotReject(() =>
        signInWithEmailAndPassword("api-key", "user@example.com", "password123"),
      );
    },
  );
});

test("signInWithEmailAndPassword reports non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(200, "nope"),
    async () => {
      await assert.rejects(
        signInWithEmailAndPassword("api-key", "user@example.com", "password123"),
        { message: /Firebase auth API returned non-JSON response/ },
      );
    },
  );
});

test("signInWithEmailAndPassword surfaces Firebase API error payload", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(400, { error: { message: "INVALID_LOGIN_CREDENTIALS" } }),
    async () => {
      await assert.rejects(
        signInWithEmailAndPassword("api-key", "user@example.com", "bad-password"),
        { message: /Firebase auth error: INVALID_LOGIN_CREDENTIALS/ },
      );
    },
  );
});

test("signInWithEmailAndPassword rejects missing required fields", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(200, { localId: "uid-1" }),
    async () => {
      await assert.rejects(
        signInWithEmailAndPassword("api-key", "user@example.com", "password123"),
        { message: /missing required fields/ },
      );
    },
  );
});

test("verifyFirebaseRefreshToken reports invalid refresh token", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(400, { error: { message: "INVALID_REFRESH_TOKEN" } }),
    async () => {
      const result = await verifyFirebaseRefreshToken("api-key", "refresh");
      assert.deepEqual(result, { valid: false });
    },
  );
});
