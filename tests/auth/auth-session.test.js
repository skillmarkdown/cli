const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");

const { readAuthSession, writeAuthSession, clearAuthSession } = requireDist("lib/auth/session.js");

test("writeAuthSession persists and readAuthSession restores valid session", () => {
  const dir = mkdtempSync(join(tmpdir(), "skillmd-auth-"));
  const sessionPath = join(dir, "auth.json");

  writeAuthSession(
    {
      provider: "email",
      uid: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
      projectId: "skillmarkdown",
    },
    sessionPath,
  );

  const stored = JSON.parse(readFileSync(sessionPath, "utf8"));
  assert.equal(stored.provider, "email");
  assert.deepEqual(readAuthSession(sessionPath), stored);
});

test("readAuthSession returns null for invalid provider", () => {
  const dir = mkdtempSync(join(tmpdir(), "skillmd-auth-"));
  const sessionPath = join(dir, "auth.json");
  writeFileSync(
    sessionPath,
    JSON.stringify({ provider: "github", uid: "uid-1", refreshToken: "refresh-1" }),
  );

  assert.equal(readAuthSession(sessionPath), null);
});

test("readAuthSession returns null when email is invalid", () => {
  const dir = mkdtempSync(join(tmpdir(), "skillmd-auth-"));
  const sessionPath = join(dir, "auth.json");
  writeFileSync(
    sessionPath,
    JSON.stringify({
      provider: "email",
      uid: "uid-1",
      email: 123,
      refreshToken: "refresh-1",
    }),
  );

  assert.equal(readAuthSession(sessionPath), null);
});

test("clearAuthSession removes an existing session file", () => {
  const dir = mkdtempSync(join(tmpdir(), "skillmd-auth-"));
  const sessionPath = join(dir, "auth.json");
  writeFileSync(
    sessionPath,
    JSON.stringify({ provider: "email", uid: "uid-1", refreshToken: "refresh-1" }),
  );

  assert.equal(clearAuthSession(sessionPath), true);
  assert.equal(readAuthSession(sessionPath), null);
});
