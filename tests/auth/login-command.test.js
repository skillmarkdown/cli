const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runLoginCommand } = requireDist("commands/login.js");

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

async function run(args, options = {}) {
  return captureConsole(() => runLoginCommand(args, options));
}

test("login uses built-in defaults when env vars are missing", async () => {
  let called = false;
  const { result } = await run([], {
    readSession: () => null,
    env: {},
    promptForCredentials: async () => ({ email: "user@example.com", password: "password123" }),
    signInWithEmailAndPassword: async (apiKey, email) => {
      called = true;
      assert.equal(apiKey, "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok");
      assert.equal(email, "user@example.com");
      return { localId: "uid-1", email: "user@example.com", refreshToken: "refresh-1" };
    },
    writeSession: () => {},
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      username: "core",
      email: "user@example.com",
      projectId: "skillmarkdown",
      authType: "firebase",
      scope: "admin",
    }),
  });

  assert.equal(called, true);
  assert.equal(result, 0);
});

test("login succeeds and writes session", async () => {
  let savedSession = null;
  let currentSession = null;

  const { result } = await run([], {
    readSession: () => currentSession,
    env: {
      SKILLMD_FIREBASE_API_KEY: "firebase-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
    },
    promptForCredentials: async () => ({ email: "user@example.com", password: "password123" }),
    signInWithEmailAndPassword: async (apiKey, email, password) => {
      assert.equal(apiKey, "firebase-key");
      assert.equal(email, "user@example.com");
      assert.equal(password, "password123");
      return { localId: "uid-1", email: "user@example.com", refreshToken: "refresh-1" };
    },
    writeSession: (session) => {
      savedSession = session;
      currentSession = session;
    },
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      username: "core",
      email: "user@example.com",
      projectId: "skillmarkdown",
      authType: "firebase",
      scope: "admin",
    }),
  });

  assert.equal(result, 0);
  assert.deepEqual(savedSession, {
    provider: "email",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
    projectId: "skillmarkdown",
  });
});

test("login reads credentials from env for non-interactive automation", async () => {
  const { result } = await run([], {
    readSession: () => null,
    env: {
      SKILLMD_FIREBASE_API_KEY: "firebase-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
      SKILLMD_LOGIN_EMAIL: "env-user@example.com",
      SKILLMD_LOGIN_PASSWORD: "env-password",
    },
    signInWithEmailAndPassword: async (_apiKey, email, password) => {
      assert.equal(email, "env-user@example.com");
      assert.equal(password, "env-password");
      return { localId: "uid-1", email: "env-user@example.com", refreshToken: "refresh-1" };
    },
    writeSession: () => {},
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      username: "core",
      email: "env-user@example.com",
      projectId: "skillmarkdown",
      authType: "firebase",
      scope: "admin",
    }),
  });

  assert.equal(result, 0);
});

test("login does not restart auth flow when already logged in", async () => {
  let prompted = false;
  const { result } = await run([], {
    readSession: () => makeSession(),
    promptForCredentials: async () => {
      prompted = true;
      return { email: "user@example.com", password: "password123" };
    },
    verifyRefreshToken: async () => ({ valid: true }),
  });

  assert.equal(result, 0);
  assert.equal(prompted, false);
});

test("login clears stale session and reauthenticates", async () => {
  let cleared = false;
  const { result } = await run([], {
    readSession: () => makeSession({ refreshToken: "stale-refresh" }),
    verifyRefreshToken: async () => ({ valid: false }),
    clearSession: () => {
      cleared = true;
      return true;
    },
    promptForCredentials: async () => ({ email: "new@example.com", password: "password123" }),
    signInWithEmailAndPassword: async () => ({
      localId: "uid-new",
      email: "new@example.com",
      refreshToken: "refresh-new",
    }),
    writeSession: () => {},
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-new",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "uid-new",
      owner: "@core",
      username: "core",
      email: "new@example.com",
      projectId: "skillmarkdown",
      authType: "firebase",
      scope: "admin",
    }),
  });

  assert.equal(result, 0);
  assert.equal(cleared, true);
});

test("login fails when refresh token verification errors", async () => {
  const { result } = await run([], {
    readSession: () => makeSession(),
    verifyRefreshToken: async () => {
      throw new Error("request timed out");
    },
  });

  assert.equal(result, 1);
});

test("login fails when sign-in rejects the provided email", async () => {
  const { result, errors } = await run([], {
    readSession: () => null,
    promptForCredentials: async () => ({ email: "missing@example.com", password: "password123" }),
    signInWithEmailAndPassword: async () => {
      throw new Error("invalid email or password");
    },
  });

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /invalid email or password/);
});

test("login fails and clears session when owner profile is missing", async () => {
  let cleared = false;
  let currentSession = null;
  const { result, errors } = await run([], {
    readSession: () => currentSession,
    promptForCredentials: async () => ({ email: "user@example.com", password: "password123" }),
    signInWithEmailAndPassword: async () => ({
      localId: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
    }),
    writeSession: (session) => {
      currentSession = session;
    },
    clearSession: () => {
      cleared = true;
      return true;
    },
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => {
      throw new Error("account profile not found");
    },
  });

  assert.equal(result, 1);
  assert.equal(cleared, true);
  assert.match(errors.join("\n"), /account profile not found/);
});

test("login fails with usage on unsupported flags", async () => {
  const { result, errors } = await run(["--bad-flag"]);

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /unsupported argument/);
  assert.match(errors.join("\n"), /Usage: skillmd login/);
});

test("login --status prints session status without prompting", async () => {
  let prompted = false;
  const { result, logs } = await run(["--status"], {
    readSession: () => makeSession(),
    promptForCredentials: async () => {
      prompted = true;
      return { email: "user@example.com", password: "password123" };
    },
  });

  assert.equal(result, 0);
  assert.equal(prompted, false);
  assert.match(logs.join("\n"), /Logged in as user@example.com/);
});

test("login --reauth bypasses an existing valid session", async () => {
  let prompted = false;
  let verified = false;
  let currentSession = makeSession();

  const { result } = await run(["--reauth"], {
    readSession: () => currentSession,
    verifyRefreshToken: async () => {
      verified = true;
      return { valid: true };
    },
    clearSession: () => true,
    promptForCredentials: async () => {
      prompted = true;
      return { email: "reauth@example.com", password: "password123" };
    },
    signInWithEmailAndPassword: async () => ({
      localId: "uid-reauth",
      email: "reauth@example.com",
      refreshToken: "refresh-reauth",
    }),
    writeSession: (session) => {
      currentSession = session;
    },
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-reauth",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "uid-reauth",
      owner: "@core",
      username: "core",
      email: "reauth@example.com",
      projectId: "skillmarkdown",
      authType: "firebase",
      scope: "admin",
    }),
  });

  assert.equal(result, 0);
  assert.equal(verified, false);
  assert.equal(prompted, true);
  assert.equal(currentSession.email, "reauth@example.com");
});

test("login clears session when token exchange succeeds but no session remains", async () => {
  const { result } = await run([], {
    readSession: () => null,
    promptForCredentials: async () => ({ email: "user@example.com", password: "password123" }),
    signInWithEmailAndPassword: async () => ({
      localId: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
    }),
    writeSession: () => {},
  });

  assert.equal(result, 0);
});

test("login reports username bootstrap failure and clears session", async () => {
  let cleared = false;
  let currentSession = null;

  const { result, errors } = await run([], {
    readSession: () => currentSession,
    promptForCredentials: async () => ({ email: "user@example.com", password: "password123" }),
    signInWithEmailAndPassword: async () => ({
      localId: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
    }),
    writeSession: (session) => {
      currentSession = session;
    },
    clearSession: () => {
      cleared = true;
      currentSession = null;
      return true;
    },
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => {
      throw "signup incomplete";
    },
  });

  assert.equal(result, 1);
  assert.equal(cleared, true);
  assert.match(errors.join("\n"), /account profile not found/);
});

test("login reports non-Error failures with fallback text", async () => {
  const { result, errors } = await run([], {
    env: {
      SKILLMD_FIREBASE_API_KEY: "firebase-key",
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
    },
    readSession: () => null,
    promptForCredentials: async () => {
      throw "cancelled";
    },
  });

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skillmd login: Unknown error/);
});
