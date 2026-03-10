const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveWriteAuth } = requireDist("lib/auth/write-auth.js");

function makeConfig() {
  return {
    firebaseApiKey: "firebase-key",
    firebaseProjectId: "skillmarkdown",
    registryBaseUrl: "https://registry.skillmarkdown.test",
    requestTimeoutMs: 1000,
  };
}

function makeSession(overrides = {}) {
  return {
    provider: "email",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
    projectId: "skillmarkdown",
    ...overrides,
  };
}

test("returns configured auth token when present", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd tag",
    env: { SKILLMD_AUTH_TOKEN: "token-123" },
    config: makeConfig(),
  });

  assert.deepEqual(result, { ok: true, value: { idToken: "token-123", owner: null } });
});

test("fails when session is missing", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd tag",
    config: makeConfig(),
    readSession: () => null,
  });

  assert.deepEqual(result, {
    ok: false,
    message: "skillmd tag: not logged in. Run 'skillmd login' first.",
  });
});

test("fails when owner profile is missing for owner-scoped commands", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd tag",
    config: makeConfig(),
    readSession: () => makeSession(),
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => {
      throw new Error("account profile not found");
    },
    requireOwner: true,
  });

  assert.deepEqual(result, {
    ok: false,
    message:
      "skillmd tag: account profile not found. Complete sign-up on the web before using this command.",
  });
});

test("allows explicit non-personal owner targets and leaves authz to the backend", async () => {
  const result = await resolveWriteAuth({
    command: "skillmd tag",
    config: makeConfig(),
    readSession: () => makeSession(),
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({ owner: "@testuser", username: "testuser" }),
    requireOwner: true,
    targetOwnerSlug: "other",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      idToken: "id-token",
      owner: "@testuser",
    },
  });
});
