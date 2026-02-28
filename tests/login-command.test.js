const test = require("node:test");
const assert = require("node:assert/strict");

const { DEFAULT_LOGIN_AUTH_CONFIG } = require("../dist/lib/auth-defaults.js");
const { runLoginCommand } = require("../dist/commands/login.js");

function mockDeviceCode() {
  return {
    deviceCode: "dev-123",
    userCode: "ABCD-EFGH",
    verificationUri: "https://github.com/login/device",
    verificationUriComplete: "https://github.com/login/device?user_code=ABCD-EFGH",
    expiresIn: 900,
    interval: 1,
  };
}

test("fails with usage on unsupported flags", async () => {
  const exitCode = await runLoginCommand(["--bad-flag"]);
  assert.equal(exitCode, 1);
});

test("fails with usage when --status and --reauth are combined", async () => {
  const exitCode = await runLoginCommand(["--status", "--reauth"]);
  assert.equal(exitCode, 1);
});

test("shows not logged in status when no session exists", async () => {
  const exitCode = await runLoginCommand(["--status"], {
    readSession: () => null,
  });
  assert.equal(exitCode, 1);
});

test("shows logged in status when session exists", async () => {
  const exitCode = await runLoginCommand(["--status"], {
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh",
    }),
  });
  assert.equal(exitCode, 0);
});

test("login uses built-in defaults when env vars are missing", async () => {
  let called = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => null,
    env: {},
    requestDeviceCode: async (clientId) => {
      called = true;
      assert.equal(clientId, DEFAULT_LOGIN_AUTH_CONFIG.githubClientId);
      return mockDeviceCode();
    },
    pollForAccessToken: async () => ({ accessToken: "gh-token" }),
    signInWithGitHubAccessToken: async (apiKey) => {
      assert.equal(apiKey, DEFAULT_LOGIN_AUTH_CONFIG.firebaseApiKey);
      return {
        localId: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh-1",
      };
    },
    writeSession: () => {},
  });

  assert.equal(called, true);
  assert.equal(exitCode, 0);
});

test("login succeeds and writes session", async () => {
  let savedSession = null;

  const exitCode = await runLoginCommand([], {
    readSession: () => null,
    env: {
      SKILLMD_GITHUB_CLIENT_ID: "gh-client",
      SKILLMD_FIREBASE_API_KEY: "firebase-key",
    },
    requestDeviceCode: async (clientId) => {
      assert.equal(clientId, "gh-client");
      return mockDeviceCode();
    },
    pollForAccessToken: async (clientId, deviceCode) => {
      assert.equal(clientId, "gh-client");
      assert.equal(deviceCode, "dev-123");
      return { accessToken: "gh-token" };
    },
    signInWithGitHubAccessToken: async (apiKey, token) => {
      assert.equal(apiKey, "firebase-key");
      assert.equal(token, "gh-token");
      return {
        localId: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh-1",
      };
    },
    writeSession: (session) => {
      savedSession = session;
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(savedSession, {
    provider: "github",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
  });
});

test("login does not restart auth flow when already logged in", async () => {
  let requestedDeviceCode = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh",
    }),
    requestDeviceCode: async () => {
      requestedDeviceCode = true;
      return mockDeviceCode();
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(requestedDeviceCode, false);
});

test("login --reauth restarts auth flow even when already logged in", async () => {
  let requestedDeviceCode = false;
  let savedSession = null;

  const exitCode = await runLoginCommand(["--reauth"], {
    readSession: () => ({
      provider: "github",
      uid: "uid-old",
      email: "old@example.com",
      refreshToken: "refresh-old",
    }),
    env: {
      SKILLMD_GITHUB_CLIENT_ID: "gh-client",
      SKILLMD_FIREBASE_API_KEY: "firebase-key",
    },
    requestDeviceCode: async () => {
      requestedDeviceCode = true;
      return mockDeviceCode();
    },
    pollForAccessToken: async () => ({ accessToken: "gh-token-new" }),
    signInWithGitHubAccessToken: async () => ({
      localId: "uid-new",
      email: "new@example.com",
      refreshToken: "refresh-new",
    }),
    writeSession: (session) => {
      savedSession = session;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(requestedDeviceCode, true);
  assert.deepEqual(savedSession, {
    provider: "github",
    uid: "uid-new",
    email: "new@example.com",
    refreshToken: "refresh-new",
  });
});
