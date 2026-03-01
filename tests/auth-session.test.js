const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} = require("../dist/lib/auth-session.js");
const { makeTempDirectory, cleanupDirectory } = require("./helpers/fs-test-utils.js");

const AUTH_SESSION_TEST_PREFIX = "skillmd-auth-session-";

function createSessionPath() {
  const root = makeTempDirectory(AUTH_SESSION_TEST_PREFIX);
  return {
    root,
    sessionPath: path.join(root, ".skillmd", "auth.json"),
  };
}

test("readAuthSession returns null when file is missing", () => {
  const { root, sessionPath } = createSessionPath();

  try {
    assert.equal(readAuthSession(sessionPath), null);
  } finally {
    cleanupDirectory(root);
  }
});

test("writeAuthSession and readAuthSession round-trip valid session", () => {
  const { root, sessionPath } = createSessionPath();
  const session = {
    provider: "github",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
  };

  try {
    writeAuthSession(session, sessionPath);
    const loaded = readAuthSession(sessionPath);
    assert.deepEqual(loaded, session);
  } finally {
    cleanupDirectory(root);
  }
});

test("readAuthSession returns null for invalid JSON", () => {
  const { root, sessionPath } = createSessionPath();

  try {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, "{not-json", "utf8");
    assert.equal(readAuthSession(sessionPath), null);
  } finally {
    cleanupDirectory(root);
  }
});

test("readAuthSession returns null for invalid shape", () => {
  const { root, sessionPath } = createSessionPath();

  try {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(
      sessionPath,
      JSON.stringify({
        provider: "github",
        uid: "uid-1",
      }),
      "utf8",
    );
    assert.equal(readAuthSession(sessionPath), null);
  } finally {
    cleanupDirectory(root);
  }
});

test("clearAuthSession returns true when file existed and false otherwise", () => {
  const { root, sessionPath } = createSessionPath();
  const session = {
    provider: "github",
    uid: "uid-1",
    refreshToken: "refresh-1",
  };

  try {
    writeAuthSession(session, sessionPath);
    assert.equal(clearAuthSession(sessionPath), true);
    assert.equal(clearAuthSession(sessionPath), false);
  } finally {
    cleanupDirectory(root);
  }
});
