const { describe, it } = require("node:test");
const assert = require("node:assert");

const { requireDist } = require("../helpers/dist-imports.js");
const { deriveOwnerFromSession } = requireDist("lib/auth/owner.js");

describe("Security: Owner Derivation", () => {
  describe("deriveOwnerFromSession", () => {
    it("derives owner from valid githubUsername", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "testuser",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, "@testuser");
    });

    it("normalizes username to lowercase", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "TestUser",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, "@testuser");
    });

    it("strips leading @ symbols", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "@@testuser",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, "@testuser");
    });

    it("returns null when githubUsername is missing", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, null);
    });

    it("returns null when githubUsername is empty", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, null);
    });

    it("returns null when githubUsername is whitespace only", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "   ",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, null);
    });

    it("returns null for invalid username format (special chars)", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "test@user",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, null);
    });

    it("returns null for invalid username format (spaces)", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "test user",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, null);
    });

    it("accepts usernames with hyphens", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "test-user",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, "@test-user");
    });

    it("accepts usernames with numbers", () => {
      const session = {
        provider: "github",
        uid: "test-uid-123",
        githubUsername: "testuser123",
        refreshToken: "refresh-token-here",
      };

      const owner = deriveOwnerFromSession(session);
      assert.strictEqual(owner, "@testuser123");
    });
  });
});
