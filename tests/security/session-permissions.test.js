const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { mkdtempSync, rmSync, statSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { requireDist } = require("../helpers/dist-imports.js");
const { writeAuthSession, readAuthSession, clearAuthSession } = requireDist("lib/auth/session.js");

describe("Security: Session File Permissions", () => {
  let testDir;
  let testSessionPath;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), "skillmd-test-"));
    testSessionPath = join(testDir, "auth.json");
  });

  after(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("writeAuthSession", () => {
    it("creates directory with 0o700 permissions (owner-only)", () => {
      const nestedPath = join(testDir, "nested", "auth.json");

      writeAuthSession(
        {
          provider: "github",
          uid: "test-uid-123",
          githubUsername: "testuser",
          refreshToken: "refresh-token-here",
        },
        nestedPath,
      );

      const dirPath = join(testDir, "nested");
      const dirStats = statSync(dirPath);

      // Check directory permissions (0o700 = owner rwx only)
      const dirPerms = dirStats.mode & 0o777;
      assert.strictEqual(dirPerms, 0o700, "Directory should have 0o700 permissions");
    });

    it("creates file with 0o600 permissions (owner read/write only)", () => {
      writeAuthSession(
        {
          provider: "github",
          uid: "test-uid-123",
          githubUsername: "testuser",
          refreshToken: "refresh-token-here",
        },
        testSessionPath,
      );

      const fileStats = statSync(testSessionPath);

      // Check file permissions (0o600 = owner rw only)
      const filePerms = fileStats.mode & 0o777;
      assert.strictEqual(filePerms, 0o600, "File should have 0o600 permissions");
    });

    it("writes valid session data", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "testuser",
        email: "test@example.com",
        refreshToken: "refresh-token-here",
        projectId: "skillmarkdown-development",
      };

      writeAuthSession(session, testSessionPath);
      const readSession = readAuthSession(testSessionPath);

      assert.deepStrictEqual(readSession, session);
    });

    it("rejects reading non-existent session", () => {
      const nonExistentPath = join(testDir, "does-not-exist.json");
      const result = readAuthSession(nonExistentPath);
      assert.strictEqual(result, null);
    });

    it("rejects reading malformed JSON session", () => {
      const malformedPath = join(testDir, "malformed.json");
      const fs = require("node:fs");
      fs.writeFileSync(malformedPath, "not valid json {", { mode: 0o600 });

      const result = readAuthSession(malformedPath);
      assert.strictEqual(result, null);
    });

    it("rejects session missing required fields", () => {
      const incompletePath = join(testDir, "incomplete.json");
      const fs = require("node:fs");
      fs.writeFileSync(
        incompletePath,
        JSON.stringify({
          provider: "github",
          // Missing uid
          refreshToken: "refresh-token-here",
        }),
        { mode: 0o600 },
      );

      const result = readAuthSession(incompletePath);
      assert.strictEqual(result, null);
    });

    it("rejects session with invalid provider", () => {
      const invalidProviderPath = join(testDir, "invalid-provider.json");
      const fs = require("node:fs");
      fs.writeFileSync(
        invalidProviderPath,
        JSON.stringify({
          provider: "not-github",
          uid: "test-uid",
          refreshToken: "refresh-token-here",
        }),
        { mode: 0o600 },
      );

      const result = readAuthSession(invalidProviderPath);
      assert.strictEqual(result, null);
    });
  });

  describe("clearAuthSession", () => {
    it("removes existing session file", () => {
      const sessionPath = join(testDir, "to-clear.json");

      writeAuthSession(
        {
          provider: "github",
          uid: "test-uid",
          githubUsername: "testuser",
          refreshToken: "refresh-token",
        },
        sessionPath,
      );

      assert.strictEqual(existsSync(sessionPath), true);

      const result = clearAuthSession(sessionPath);

      assert.strictEqual(result, true);
      assert.strictEqual(existsSync(sessionPath), false);
    });

    it("returns false when session file does not exist", () => {
      const nonExistentPath = join(testDir, "already-gone.json");
      const result = clearAuthSession(nonExistentPath);
      assert.strictEqual(result, false);
    });
  });
});
