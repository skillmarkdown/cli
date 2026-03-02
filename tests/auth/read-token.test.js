const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveReadIdToken } = requireDist("lib/auth/read-token.js");

test("resolveReadIdToken returns null when no session exists", async () => {
  const token = await resolveReadIdToken({
    env: {
      SKILLMD_GITHUB_CLIENT_ID: "client-id",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => null,
  });

  assert.equal(token, null);
});

test("resolveReadIdToken returns id token when session is valid", async () => {
  const token = await resolveReadIdToken({
    env: {
      SKILLMD_GITHUB_CLIENT_ID: "client-id",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => ({
      provider: "github",
      uid: "uid_123",
      refreshToken: "refresh_123",
      projectId: "skillmarkdown-development",
    }),
    exchangeRefreshToken: async (apiKey, refreshToken) => {
      assert.equal(apiKey, "api-key");
      assert.equal(refreshToken, "refresh_123");
      return {
        idToken: "id_token_123",
        userId: "uid_123",
        expiresInSeconds: 3600,
      };
    },
  });

  assert.equal(token, "id_token_123");
});

test("resolveReadIdToken returns null on project mismatch", async () => {
  const token = await resolveReadIdToken({
    env: {
      SKILLMD_GITHUB_CLIENT_ID: "client-id",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => ({
      provider: "github",
      uid: "uid_123",
      refreshToken: "refresh_123",
      projectId: "skillmarkdown",
    }),
    exchangeRefreshToken: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(token, null);
});
