const { describe, it } = require("node:test");
const assert = require("node:assert");

const { requireDist } = require("../helpers/dist-imports.js");
const { runPublishCommand } = requireDist("commands/publish.js");

function baseOptions(overrides = {}) {
  return {
    cwd: "/tmp/publish-skill",
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "apikey",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
    },
    readSession: () => ({
      provider: "email",
      uid: "test-uid",
      email: "user@example.com",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown-development",
    }),
    getConfig: () => ({
      registryBaseUrl: "https://registry.example.com",
      firebaseApiKey: "test-key",
      firebaseProjectId: "skillmarkdown-development",
      requestTimeoutMs: 10000,
      defaultAgentTarget: "skillmd",
    }),
    validateSkill: () => ({
      status: "passed",
      warnings: [],
    }),
    checkPublishContent: () => [],
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "test-uid",
      expiresInSeconds: 3600,
    }),
    getWhoami: async () => ({
      uid: "test-uid",
      owner: "@testuser",
      username: "testuser",
      email: "test@example.com",
      projectId: "skillmarkdown-development",
      authType: "firebase",
      scope: "admin",
      plan: "pro",
      entitlements: { privateSkills: true },
    }),
    ...overrides,
  };
}

describe("Security: Replay Attack Prevention", () => {
  describe("Publish command idempotency", () => {
    it("handles version conflict gracefully (simulating replay attempt)", async () => {
      let prepareCallCount = 0;
      let commitCallCount = 0;

      // Simulate first successful publish
      const firstResult = await runPublishCommand(
        ["--version", "1.0.0"],
        baseOptions({
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
                skillId: "test-skill",
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
        }),
      );

      assert.strictEqual(firstResult, 0);
      assert.strictEqual(prepareCallCount, 1);
      assert.strictEqual(commitCallCount, 1);

      // Simulate replay attempt (same version)
      const replayResult = await runPublishCommand(
        ["--version", "1.0.0"],
        baseOptions({
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
        }),
      );

      // Replay attempt should fail with exit code 1
      assert.strictEqual(replayResult, 1);
      assert.strictEqual(prepareCallCount, 2);
      assert.strictEqual(commitCallCount, 2);
    });

    it("rejects publish when artifact exceeds max size", async () => {
      const result = await runPublishCommand(
        ["--version", "1.0.0"],
        baseOptions({
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
        }),
      );

      assert.strictEqual(result, 1);
    });

    it("rejects publish when manifest exceeds max size", async () => {
      const result = await runPublishCommand(
        ["--version", "1.0.0"],
        baseOptions({
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
        }),
      );

      assert.strictEqual(result, 1);
    });
  });
});
