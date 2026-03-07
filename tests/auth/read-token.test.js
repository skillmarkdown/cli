const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveReadIdToken } = requireDist("lib/auth/read-token.js");

test("resolveReadIdToken returns configured auth token before session resolution", async () => {
  const token = await resolveReadIdToken({
    env: {
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => null,
    exchangeRefreshToken: async () => {
      throw new Error("should not be called when auth token env is set");
    },
  });

  assert.equal(token, "skmd_dev_tok_abc123abc123abc123abc123.secret");
});

test("resolveReadIdToken returns null when no session exists", async () => {
  const token = await resolveReadIdToken({
    env: {
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
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => ({
      provider: "email",
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
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => ({
      provider: "email",
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

test("resolveReadIdToken returns null for invalid refresh token errors", async () => {
  const token = await resolveReadIdToken({
    env: {
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    readSession: () => ({
      provider: "email",
      uid: "uid_123",
      refreshToken: "refresh_123",
      projectId: "skillmarkdown-development",
    }),
    exchangeRefreshToken: async () => {
      throw new Error("Firebase secure token exchange failed (400): INVALID_REFRESH_TOKEN");
    },
  });

  assert.equal(token, null);
});

test("resolveReadIdToken throws on transient exchange failures", async () => {
  await assert.rejects(
    resolveReadIdToken({
      env: {
        SKILLMD_FIREBASE_API_KEY: "api-key",
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      },
      readSession: () => ({
        provider: "email",
        uid: "uid_123",
        refreshToken: "refresh_123",
        projectId: "skillmarkdown-development",
      }),
      exchangeRefreshToken: async () => {
        throw new Error("request timed out");
      },
    }),
    /unable to resolve read token: request timed out/i,
  );
});
