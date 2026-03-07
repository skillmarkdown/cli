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
    signInWithEmailAndPassword: async (apiKey) => {
      called = true;
      assert.equal(apiKey, "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok");
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
      ownerSlug: "core",
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
      ownerSlug: "core",
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
      ownerSlug: "core",
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
      throw new Error("owner profile not found");
    },
  });

  assert.equal(result, 1);
  assert.equal(cleared, true);
  assert.match(errors.join("\n"), /Complete sign-up on the web/);
});
