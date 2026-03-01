const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { DEFAULT_LOGIN_AUTH_CONFIG } = requireDist("lib/auth-defaults.js");
const { runLoginCommand } = requireDist("commands/login.js");

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

function makeSession(overrides = {}) {
  return {
    provider: "github",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh",
    projectId: "skillmarkdown-development",
    ...overrides,
  };
}

function makeSignedInUser(overrides = {}) {
  return {
    localId: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
    ...overrides,
  };
}

async function runStatus(options) {
  return captureConsole(() => runLoginCommand(["--status"], options));
}

for (const args of [["--bad-flag"], ["--status", "--reauth"]]) {
  test(`fails with usage for args: ${args.join(" ")}`, async () => {
    assert.equal(await runLoginCommand(args), 1);
  });
}

for (const [name, options, expectedExitCode, expectedPattern] of [
  [
    "shows not logged in status when no session exists",
    { readSession: () => null },
    1,
    /Not logged in\./,
  ],
  [
    "shows logged in status when session exists",
    {
      readSession: () => makeSession(),
    },
    0,
    /project: skillmarkdown-development/,
  ],
  [
    "status shows project mismatch hint when session project differs from config",
    {
      env: { SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown" },
      readSession: () => makeSession(),
    },
    0,
    /Current CLI config targets project 'skillmarkdown'/,
  ],
  [
    "status shows unknown project for legacy sessions",
    {
      env: { SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown" },
      readSession: () => ({
        provider: "github",
        uid: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh",
      }),
    },
    0,
    /project: unknown \(current config: skillmarkdown\)/,
  ],
]) {
  test(name, async () => {
    const { result, logs } = await runStatus(options);
    assert.equal(result, expectedExitCode);
    assert.match(logs.join("\n"), expectedPattern);
  });
}

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
      return makeSignedInUser();
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
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
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
      return makeSignedInUser();
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
    projectId: "skillmarkdown",
  });
});

test("login does not restart auth flow when already logged in", async () => {
  let requestedDeviceCode = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => makeSession(),
    requestDeviceCode: async () => {
      requestedDeviceCode = true;
      return mockDeviceCode();
    },
    verifyRefreshToken: async () => ({ valid: true }),
  });

  assert.equal(exitCode, 0);
  assert.equal(requestedDeviceCode, false);
});

for (const [name, clearSessionResult] of [
  ["login auto-reauthenticates when existing session token is invalid", true],
  ["login continues reauthentication even if clearing stale session fails", false],
]) {
  test(name, async () => {
    let cleared = false;
    let requestedDeviceCode = false;

    const exitCode = await runLoginCommand([], {
      readSession: () =>
        makeSession({
          uid: "uid-stale",
          email: "stale@example.com",
          refreshToken: "stale-refresh",
        }),
      verifyRefreshToken: async () => ({ valid: false }),
      clearSession: () => {
        cleared = true;
        return clearSessionResult;
      },
      requestDeviceCode: async () => {
        requestedDeviceCode = true;
        return mockDeviceCode();
      },
      pollForAccessToken: async () => ({ accessToken: "gh-token-new" }),
      signInWithGitHubAccessToken: async () =>
        makeSignedInUser({
          localId: "uid-new",
          email: "new@example.com",
          refreshToken: "refresh-new",
        }),
      writeSession: () => {},
    });

    assert.equal(exitCode, 0);
    assert.equal(cleared, true);
    assert.equal(requestedDeviceCode, true);
  });
}

test("login fails when token verification is inconclusive due to transient error", async () => {
  let requestedDeviceCode = false;
  let cleared = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => makeSession(),
    verifyRefreshToken: async () => {
      throw new Error("request timed out");
    },
    clearSession: () => {
      cleared = true;
      return true;
    },
    requestDeviceCode: async () => {
      requestedDeviceCode = true;
      return mockDeviceCode();
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(cleared, false);
  assert.equal(requestedDeviceCode, false);
});

test("login --reauth restarts auth flow even when already logged in", async () => {
  let requestedDeviceCode = false;
  let savedSession = null;

  const exitCode = await runLoginCommand(["--reauth"], {
    readSession: () =>
      makeSession({ uid: "uid-old", email: "old@example.com", refreshToken: "refresh-old" }),
    env: {
      SKILLMD_GITHUB_CLIENT_ID: "gh-client",
      SKILLMD_FIREBASE_API_KEY: "firebase-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
    },
    requestDeviceCode: async () => {
      requestedDeviceCode = true;
      return mockDeviceCode();
    },
    pollForAccessToken: async () => ({ accessToken: "gh-token-new" }),
    signInWithGitHubAccessToken: async () =>
      makeSignedInUser({
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
    projectId: "skillmarkdown",
  });
});
