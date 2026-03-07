const { describe, it } = require("node:test");
const assert = require("node:assert");

const { requireDist } = require("../helpers/dist-imports.js");
const { runPublishCommand } = requireDist("commands/publish.js");

describe("Security: Replay Attack Prevention", () => {
  describe("Publish command idempotency", () => {
    it("handles version conflict gracefully (simulating replay attempt)", async () => {
      let prepareCallCount = 0;
      let commitCallCount = 0;

      // Simulate first successful publish
      const firstResult = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => ({
          provider: "email",
          uid: "test-uid",
          refreshToken: "refresh-token",
        }),
        env: {
          SKILLMD_AUTH_TOKEN: "fake-auth-token",
        },
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
        preparePublish: async () => {
          prepareCallCount++;
          return {
            status: "upload_required",
            publishToken: "pit_token123",
            uploadUrl: "https://storage.example.com/upload",
            uploadMethod: "PUT",
            uploadHeaders: {},
          };
        },
        uploadArtifact: async () => {
          // Simulate successful upload
        },
        commitPublish: async () => {
          commitCallCount++;
          if (commitCallCount === 1) {
            // First commit succeeds
            return {
              status: "published",
              skillId: "@testuser/test-skill",
              version: "1.0.0",
              tag: "latest",
              distTags: { latest: "1.0.0" },
            };
          } else {
            // Simulate version conflict on replay
            const error = new Error("version_conflict");
            error.status = 409;
            error.code = "version_conflict";
            throw error;
          }
        },
      });

      assert.strictEqual(firstResult, 0);
      assert.strictEqual(prepareCallCount, 1);
      assert.strictEqual(commitCallCount, 1);

      // Simulate replay attempt (same version)
      const replayResult = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => ({
          provider: "email",
          uid: "test-uid",
          refreshToken: "refresh-token",
        }),
        env: {
          SKILLMD_AUTH_TOKEN: "fake-auth-token",
        },
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
        preparePublish: async () => {
          prepareCallCount++;
          return {
            status: "upload_required",
            publishToken: "pit_token456",
            uploadUrl: "https://storage.example.com/upload",
            uploadMethod: "PUT",
            uploadHeaders: {},
          };
        },
        uploadArtifact: async () => {
          // Simulate successful upload
        },
        commitPublish: async () => {
          commitCallCount++;
          // Simulate version conflict on replay
          const error = new Error("version_conflict");
          error.status = 409;
          error.code = "version_conflict";
          throw error;
        },
      });

      // Replay attempt should fail with exit code 1
      assert.strictEqual(replayResult, 1);
      assert.strictEqual(prepareCallCount, 2);
      assert.strictEqual(commitCallCount, 2);
    });

    it("rejects publish when artifact exceeds max size", async () => {
      const result = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => ({
          provider: "email",
          uid: "test-uid",
          refreshToken: "refresh-token",
        }),
        env: {
          SKILLMD_AUTH_TOKEN: "fake-auth-token",
        },
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
          sizeBytes: 104857601, // 100MB + 1 byte (exceeds 100MB limit)
          mediaType: "application/gzip",
        }),
      });

      assert.strictEqual(result, 1);
    });

    it("rejects publish when manifest exceeds max size", async () => {
      const result = await runPublishCommand(["--version", "1.0.0"], {
        readSession: () => ({
          provider: "email",
          uid: "test-uid",
          refreshToken: "refresh-token",
        }),
        env: {
          SKILLMD_AUTH_TOKEN: "fake-auth-token",
        },
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
          // Add large metadata to exceed manifest size
          largeMetadata: "x".repeat(10485761), // 10MB + 1 byte
        }),
      });

      assert.strictEqual(result, 1);
    });
  });
});
