const { describe, it } = require("node:test");
const assert = require("node:assert");

const { requireDist } = require("../helpers/dist-imports.js");
const { runPublishCommand } = requireDist("commands/publish.js");

describe("Security: Artifact Integrity Verification", () => {
  describe("Publish command validates artifact integrity", () => {
    it("includes digest and size in prepare request", async () => {
      let preparePayload = null;

      await runPublishCommand(["--version", "1.0.0"], {
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
          tarGz: Buffer.from("fake-artifact-content"),
          digest: "sha256:abc123def456",
          sizeBytes: 2048,
          mediaType: "application/gzip",
        }),
        buildManifest: () => ({
          name: "test-skill",
          version: "1.0.0",
          description: "Test skill",
        }),
        preparePublish: async (baseUrl, idToken, payload) => {
          preparePayload = payload;
          return {
            status: "upload_required",
            publishToken: "pit_token123",
            uploadUrl: "https://storage.example.com/upload",
            uploadMethod: "PUT",
            uploadHeaders: {},
          };
        },
        uploadArtifact: async () => {},
        commitPublish: async () => ({
          status: "published",
          skillId: "@testuser/test-skill",
          version: "1.0.0",
          tag: "latest",
          distTags: { latest: "1.0.0" },
        }),
      });

      assert.ok(preparePayload, "preparePublish should have been called");
      assert.strictEqual(preparePayload.digest, "sha256:abc123def456");
      assert.strictEqual(preparePayload.sizeBytes, 2048);
      assert.strictEqual(preparePayload.mediaType, "application/gzip");
    });

    it("includes manifest in prepare request for validation", async () => {
      let preparePayload = null;

      const expectedManifest = {
        name: "test-skill",
        version: "1.0.0",
        description: "Test skill with integrity",
        license: "MIT",
      };

      await runPublishCommand(["--version", "1.0.0"], {
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
        buildManifest: () => expectedManifest,
        preparePublish: async (baseUrl, idToken, payload) => {
          preparePayload = payload;
          return {
            status: "upload_required",
            publishToken: "pit_token123",
            uploadUrl: "https://storage.example.com/upload",
            uploadMethod: "PUT",
            uploadHeaders: {},
          };
        },
        uploadArtifact: async () => {},
        commitPublish: async () => ({
          status: "published",
          skillId: "@testuser/test-skill",
          version: "1.0.0",
          tag: "latest",
          distTags: { latest: "1.0.0" },
        }),
      });

      assert.ok(preparePayload, "preparePublish should have been called");
      assert.deepStrictEqual(preparePayload.manifest, expectedManifest);
    });

    it("passes provenance flag to prepare request", async () => {
      let preparePayload = null;

      await runPublishCommand(["--version", "1.0.0", "--provenance"], {
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
        preparePublish: async (baseUrl, idToken, payload) => {
          preparePayload = payload;
          return {
            status: "upload_required",
            publishToken: "pit_token123",
            uploadUrl: "https://storage.example.com/upload",
            uploadMethod: "PUT",
            uploadHeaders: {},
          };
        },
        uploadArtifact: async () => {},
        commitPublish: async () => ({
          status: "published",
          skillId: "@testuser/test-skill",
          version: "1.0.0",
          tag: "latest",
          distTags: { latest: "1.0.0" },
          provenance: { requested: true, recorded: true },
        }),
      });

      assert.ok(preparePayload, "preparePublish should have been called");
      assert.strictEqual(preparePayload.provenance, true);
    });

    it("uses correct access level (public vs private)", async () => {
      let preparePayload = null;

      await runPublishCommand(["--version", "1.0.0", "--access", "private"], {
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
        preparePublish: async (baseUrl, idToken, payload) => {
          preparePayload = payload;
          return {
            status: "upload_required",
            publishToken: "pit_token123",
            uploadUrl: "https://storage.example.com/upload",
            uploadMethod: "PUT",
            uploadHeaders: {},
          };
        },
        uploadArtifact: async () => {},
        commitPublish: async () => ({
          status: "published",
          skillId: "@testuser/test-skill",
          version: "1.0.0",
          tag: "latest",
          distTags: { latest: "1.0.0" },
        }),
      });

      assert.ok(preparePayload, "preparePublish should have been called");
      assert.strictEqual(preparePayload.access, "private");
    });
  });
});
