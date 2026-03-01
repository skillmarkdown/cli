const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");

const { clearAuthSession, readAuthSession, writeAuthSession } = requireDist("lib/auth/session.js");

const AUTH_SESSION_TEST_PREFIX = "skillmd-auth-session-";

function withSessionPath(run) {
  const root = makeTempDirectory(AUTH_SESSION_TEST_PREFIX);
  const sessionPath = path.join(root, ".skillmd", "auth.json");

  try {
    run({ root, sessionPath });
  } finally {
    cleanupDirectory(root);
  }
}

function writeRawSession(sessionPath, value) {
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, value, "utf8");
}

test("readAuthSession returns null when file is missing", () => {
  withSessionPath(({ sessionPath }) => {
    assert.equal(readAuthSession(sessionPath), null);
  });
});

test("writeAuthSession and readAuthSession round-trip valid session", () => {
  const session = {
    provider: "github",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
    projectId: "skillmarkdown",
  };

  withSessionPath(({ sessionPath }) => {
    writeAuthSession(session, sessionPath);
    const loaded = readAuthSession(sessionPath);
    assert.deepEqual(loaded, session);
  });
});

test("readAuthSession returns null for invalid JSON", () => {
  withSessionPath(({ sessionPath }) => {
    writeRawSession(sessionPath, "{not-json");
    assert.equal(readAuthSession(sessionPath), null);
  });
});

test("readAuthSession returns null for invalid shape", () => {
  withSessionPath(({ sessionPath }) => {
    writeRawSession(
      sessionPath,
      JSON.stringify({
        provider: "github",
        uid: "uid-1",
      }),
    );
    assert.equal(readAuthSession(sessionPath), null);
  });
});

test("readAuthSession accepts legacy sessions without projectId", () => {
  withSessionPath(({ sessionPath }) => {
    writeRawSession(
      sessionPath,
      JSON.stringify({
        provider: "github",
        uid: "uid-legacy",
        refreshToken: "refresh-legacy",
      }),
    );

    assert.deepEqual(readAuthSession(sessionPath), {
      provider: "github",
      uid: "uid-legacy",
      refreshToken: "refresh-legacy",
    });
  });
});

test("readAuthSession returns null when projectId is empty", () => {
  withSessionPath(({ sessionPath }) => {
    writeRawSession(
      sessionPath,
      JSON.stringify({
        provider: "github",
        uid: "uid-1",
        refreshToken: "refresh-1",
        projectId: "",
      }),
    );
    assert.equal(readAuthSession(sessionPath), null);
  });
});

test("clearAuthSession returns true when file existed and false otherwise", () => {
  const session = {
    provider: "github",
    uid: "uid-1",
    refreshToken: "refresh-1",
  };

  withSessionPath(({ sessionPath }) => {
    writeAuthSession(session, sessionPath);
    assert.equal(clearAuthSession(sessionPath), true);
    assert.equal(clearAuthSession(sessionPath), false);
  });
});
