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

async function captureConsole(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const logs = [];
  const errors = [];

  console.log = (...args) => {
    logs.push(args.join(" "));
  };
  console.error = (...args) => {
    errors.push(args.join(" "));
  };

  try {
    const result = await fn();
    return { result, logs, errors };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
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
  const { result, logs } = await captureConsole(() =>
    runLoginCommand(["--status"], {
      readSession: () => ({
        provider: "github",
        uid: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh",
        projectId: "skillmarkdown-development",
      }),
    }),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /project: skillmarkdown-development/);
});

test("status shows project mismatch hint when session project differs from config", async () => {
  const { result, logs } = await captureConsole(() =>
    runLoginCommand(["--status"], {
      env: {
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
      },
      readSession: () => ({
        provider: "github",
        uid: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh",
        projectId: "skillmarkdown-development",
      }),
    }),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Current CLI config targets project 'skillmarkdown'/);
});

test("status shows unknown project for legacy sessions", async () => {
  const { result, logs } = await captureConsole(() =>
    runLoginCommand(["--status"], {
      env: {
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
      },
      readSession: () => ({
        provider: "github",
        uid: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh",
      }),
    }),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /project: unknown \(current config: skillmarkdown\)/);
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
    projectId: "skillmarkdown",
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
      projectId: "skillmarkdown-development",
    }),
    requestDeviceCode: async () => {
      requestedDeviceCode = true;
      return mockDeviceCode();
    },
    verifyRefreshToken: async () => ({ valid: true }),
  });

  assert.equal(exitCode, 0);
  assert.equal(requestedDeviceCode, false);
});

test("login auto-reauthenticates when existing session token is invalid", async () => {
  let cleared = false;
  let requestedDeviceCode = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => ({
      provider: "github",
      uid: "uid-stale",
      email: "stale@example.com",
      refreshToken: "stale-refresh",
      projectId: "skillmarkdown-development",
    }),
    verifyRefreshToken: async () => ({ valid: false }),
    clearSession: () => {
      cleared = true;
      return true;
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
    writeSession: () => {},
  });

  assert.equal(exitCode, 0);
  assert.equal(cleared, true);
  assert.equal(requestedDeviceCode, true);
});

test("login continues reauthentication even if clearing stale session fails", async () => {
  let cleared = false;
  let requestedDeviceCode = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => ({
      provider: "github",
      uid: "uid-stale",
      email: "stale@example.com",
      refreshToken: "stale-refresh",
      projectId: "skillmarkdown-development",
    }),
    verifyRefreshToken: async () => ({ valid: false }),
    clearSession: () => {
      cleared = true;
      return false;
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
    writeSession: () => {},
  });

  assert.equal(exitCode, 0);
  assert.equal(cleared, true);
  assert.equal(requestedDeviceCode, true);
});

test("login fails when token verification is inconclusive due to transient error", async () => {
  let requestedDeviceCode = false;
  let cleared = false;

  const exitCode = await runLoginCommand([], {
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh",
      projectId: "skillmarkdown-development",
    }),
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
    readSession: () => ({
      provider: "github",
      uid: "uid-old",
      email: "old@example.com",
      refreshToken: "refresh-old",
      projectId: "skillmarkdown-development",
    }),
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
    projectId: "skillmarkdown",
  });
});
