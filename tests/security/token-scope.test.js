const { describe, it } = require("node:test");
const assert = require("node:assert");

const { requireDist } = require("../helpers/dist-imports.js");
const { runPublishCommand } = requireDist("commands/publish.js");

describe("Security: Token Scope Enforcement", () => {
  describe("Publish command with insufficient scope", () => {
    it("fails when not logged in (no auth)", async () => {
      const result = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => null,
        getConfig: () => ({
          registryBaseUrl: "https://registry.skillmarkdown.com",
          firebaseApiKey: "test-key",
          firebaseProjectId: "skillmarkdown",
          requestTimeoutMs: 10000,
          defaultAgentTarget: "skillmd",
        }),
        validateSkill: () => ({
          status: "passed",
          warnings: [],
        }),
        packArtifact: () => ({
          tarGz: Buffer.from("fake-artifact"),
          digest: "sha256:abc123",
          sizeBytes: 1024,
          mediaType: "application/gzip",
        }),
        buildManifest: () => ({
          name: "test-skill",
          version: "1.0.0",
          description: "Test skill",
        }),
      });

      assert.strictEqual(result, 1);
    });

    it("fails when session exists but owner cannot be derived", async () => {
      const result = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => ({
          provider: "email",
          uid: "test-uid",
          refreshToken: "refresh-token",
          // Missing githubUsername
        }),
        getConfig: () => ({
          registryBaseUrl: "https://registry.skillmarkdown.com",
          firebaseApiKey: "test-key",
          firebaseProjectId: "skillmarkdown",
          requestTimeoutMs: 10000,
          defaultAgentTarget: "skillmd",
        }),
        validateSkill: () => ({
          status: "passed",
          warnings: [],
        }),
        packArtifact: () => ({
          tarGz: Buffer.from("fake-artifact"),
          digest: "sha256:abc123",
          sizeBytes: 1024,
          mediaType: "application/gzip",
        }),
        buildManifest: () => ({
          name: "test-skill",
          version: "1.0.0",
          description: "Test skill",
        }),
      });

      assert.strictEqual(result, 1);
    });
  });

  describe("Session validation", () => {
    it("rejects session with mismatched projectId", async () => {
      const result = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => ({
          provider: "email",
          uid: "test-uid",
          refreshToken: "refresh-token",
          projectId: "different-project",
        }),
        env: {},
        getConfig: () => ({
          registryBaseUrl: "https://registry.skillmarkdown.com",
          firebaseApiKey: "test-key",
          firebaseProjectId: "skillmarkdown", // Different from session
          requestTimeoutMs: 10000,
          defaultAgentTarget: "skillmd",
        }),
        validateSkill: () => ({
          status: "passed",
          warnings: [],
        }),
        packArtifact: () => ({
          tarGz: Buffer.from("fake-artifact"),
          digest: "sha256:abc123",
          sizeBytes: 1024,
          mediaType: "application/gzip",
        }),
        buildManifest: () => ({
          name: "test-skill",
          version: "1.0.0",
          description: "Test skill",
        }),
      });

      assert.strictEqual(result, 1);
    });
  });
});
