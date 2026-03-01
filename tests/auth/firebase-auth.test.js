const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  mockJsonResponse,
  mockTextResponse,
  withMockedFetch,
} = require("../helpers/fetch-test-utils.js");

const { signInWithGitHubAccessToken, verifyFirebaseRefreshToken } = requireDist(
  "lib/auth/firebase-auth.js",
);

test("signInWithGitHubAccessToken returns mapped Firebase session", async () => {
  const result = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        localId: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh-1",
      }),
    () => signInWithGitHubAccessToken("api-key", "gh-token"),
  );

  assert.deepEqual(result, {
    localId: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
  });
});

test("signInWithGitHubAccessToken reports non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(200, "not-json"),
    async () => {
      await assert.rejects(signInWithGitHubAccessToken("api-key", "gh-token"), {
        message: /Firebase auth API returned non-JSON response \(200\)/,
      });
    },
  );
});

test("signInWithGitHubAccessToken surfaces Firebase API error payload", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(400, {
        error: {
          message: "INVALID_IDP_RESPONSE",
        },
      }),
    async () => {
      await assert.rejects(signInWithGitHubAccessToken("api-key", "gh-token"), {
        message: /Firebase auth error: INVALID_IDP_RESPONSE/,
      });
    },
  );
});

test("signInWithGitHubAccessToken rejects missing required fields", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(200, { localId: "uid-1" }),
    async () => {
      await assert.rejects(signInWithGitHubAccessToken("api-key", "gh-token"), {
        message: /missing required fields/,
      });
    },
  );
});

test("verifyFirebaseRefreshToken returns valid on successful refresh", async () => {
  const result = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        refresh_token: "refresh-1",
        access_token: "access-1",
      }),
    () => verifyFirebaseRefreshToken("api-key", "refresh-token"),
  );

  assert.deepEqual(result, { valid: true });
});

for (const errorMessage of ["INVALID_REFRESH_TOKEN", "TOKEN_EXPIRED", "PROJECT_NUMBER_MISMATCH"]) {
  test(`verifyFirebaseRefreshToken returns invalid for ${errorMessage}`, async () => {
    const result = await withMockedFetch(
      async () =>
        mockJsonResponse(400, {
          error: {
            message: errorMessage,
          },
        }),
      () => verifyFirebaseRefreshToken("api-key", "refresh-token"),
    );

    assert.deepEqual(result, { valid: false });
  });
}

test("verifyFirebaseRefreshToken rejects successful responses missing required fields", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(200, { refresh_token: "refresh-1" }),
    async () => {
      await assert.rejects(verifyFirebaseRefreshToken("api-key", "refresh-token"), {
        message: /missing required fields/,
      });
    },
  );
});

test("verifyFirebaseRefreshToken reports non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(200, "not-json"),
    async () => {
      await assert.rejects(verifyFirebaseRefreshToken("api-key", "refresh-token"), {
        message: /non-JSON response \(200\)/,
      });
    },
  );
});

test("verifyFirebaseRefreshToken throws on non-recoverable API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(500, {
        error: {
          message: "INTERNAL",
        },
      }),
    async () => {
      await assert.rejects(verifyFirebaseRefreshToken("api-key", "refresh-token"), {
        message: /Firebase token verification failed \(500\): INTERNAL/,
      });
    },
  );
});
