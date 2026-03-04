const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveWriteAuth } = requireDist("lib/auth/write-auth.js");

const BASE_CONFIG = {
  firebaseApiKey: "api-key",
  firebaseProjectId: "skillmarkdown-development",
};

test("resolveWriteAuth returns configured auth token without session lookup", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd publish",
    env: {
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
    },
    config: BASE_CONFIG,
    readSession: () => {
      throw new Error("should not be called");
    },
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      idToken: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      owner: null,
    },
  });
});

test("resolveWriteAuth fails when no token and no session", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd publish",
    env: {},
    config: BASE_CONFIG,
    readSession: () => null,
  });

  assert.deepEqual(result, {
    ok: false,
    message: "skillmd publish: not logged in. Run 'skillmd login' first.",
  });
});

test("resolveWriteAuth fails on project mismatch", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd publish",
    env: {},
    config: BASE_CONFIG,
    readSession: () => ({
      provider: "github",
      uid: "uid_123",
      refreshToken: "refresh_123",
      projectId: "skillmarkdown",
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    message:
      "skillmd publish: session project 'skillmarkdown' does not match current config " +
      "'skillmarkdown-development'. Run 'skillmd login --reauth' to switch projects.",
  });
});

test("resolveWriteAuth fails when owner is required but missing", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd tag",
    env: {},
    config: BASE_CONFIG,
    requireOwner: true,
    readSession: () => ({
      provider: "github",
      uid: "uid_123",
      refreshToken: "refresh_123",
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    message: "skillmd tag: missing GitHub username in session. Run 'skillmd login --reauth' first.",
  });
});

test("resolveWriteAuth enforces owner match and returns id token on success", async () => {
  const mismatch = await resolveWriteAuth({
    command: "skillmd tag",
    env: {},
    config: BASE_CONFIG,
    requireOwner: true,
    targetOwnerSlug: "another-owner",
    ownerMismatchMessage: (owner) =>
      `skillmd tag: can only update tags for skills owned by ${owner}.`,
    readSession: () => ({
      provider: "github",
      uid: "uid_123",
      githubUsername: "testuser",
      refreshToken: "refresh_123",
      projectId: "skillmarkdown-development",
    }),
  });
  assert.deepEqual(mismatch, {
    ok: false,
    message: "skillmd tag: can only update tags for skills owned by @testuser.",
  });

  const success = await resolveWriteAuth({
    command: "skillmd tag",
    env: {},
    config: BASE_CONFIG,
    requireOwner: true,
    targetOwnerSlug: "testuser",
    readSession: () => ({
      provider: "github",
      uid: "uid_123",
      githubUsername: "testuser",
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

  assert.deepEqual(success, {
    ok: true,
    value: {
      idToken: "id_token_123",
      owner: "@testuser",
    },
  });
});
