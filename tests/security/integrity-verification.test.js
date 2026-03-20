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

describe("Security: Artifact Integrity Verification", () => {
  describe("Publish command validates artifact integrity", () => {
    it("includes digest and size in prepare request", async () => {
      let preparePayload = null;

      const exitCode = await runPublishCommand(
        ["--version", "1.0.0"],
        baseOptions({
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
        }),
      );

      assert.strictEqual(exitCode, 0);
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

      const exitCode = await runPublishCommand(
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
        }),
      );

      assert.strictEqual(exitCode, 0);
      assert.ok(preparePayload, "preparePublish should have been called");
      assert.deepStrictEqual(preparePayload.manifest, expectedManifest);
    });

    it("passes provenance flag to prepare request", async () => {
      let preparePayload = null;

      const exitCode = await runPublishCommand(
        ["--version", "1.0.0", "--provenance"],
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
        }),
      );

      assert.strictEqual(exitCode, 0);
      assert.ok(preparePayload, "preparePublish should have been called");
      assert.strictEqual(preparePayload.provenance, true);
    });

    it("uses correct access level (public vs private)", async () => {
      let preparePayload = null;

      const exitCode = await runPublishCommand(
        ["--version", "1.0.0", "--access", "private"],
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
        }),
      );

      assert.strictEqual(exitCode, 0);
      assert.ok(preparePayload, "preparePublish should have been called");
      assert.strictEqual(preparePayload.access, "private");
    });
  });
});
