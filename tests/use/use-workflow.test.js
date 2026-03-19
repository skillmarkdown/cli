const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { installFromRegistry } = requireDist("lib/use/workflow.js");
const { UseApiError } = requireDist("lib/use/errors.js");

function baseInput(overrides = {}) {
  return {
    registryBaseUrl: "https://registry.example.com",
    requestTimeoutMs: 10_000,
    cwd: "/workspace/project",
    username: "stefdevscore",
    skillSlug: "test-skill",
    selector: { strategy: "spec", spec: "latest" },
    defaultAgentTarget: "skillmd",
    now: () => new Date("2026-03-02T12:34:56.000Z"),
    sourceCommandFactory: ({ canonicalSkillId, resolvedAgentTarget }) => {
      const parts = ["skillmd", "use", canonicalSkillId];
      if (resolvedAgentTarget !== "skillmd") {
        parts.push("--agent-target", resolvedAgentTarget);
      }
      return parts.join(" ");
    },
    ...overrides,
  };
}

function baseDependencies(overrides = {}) {
  return {
    resolveVersion: async () => ({
      owner: "@stefdevscore",
      username: "stefdevscore",
      skill: "test-skill",
      spec: "latest",
      version: "1.2.3",
    }),
    getArtifactDescriptor: async () => ({
      owner: "@stefdevscore",
      username: "stefdevscore",
      skill: "test-skill",
      version: "1.2.3",
      digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      sizeBytes: 5,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      deprecated: false,
      deprecatedAt: null,
      deprecatedMessage: null,
      downloadUrl: "https://storage.example.com/object?signature=secret",
      downloadExpiresAt: "2026-03-02T12:40:00.000Z",
    }),
    downloadArtifact: async () => ({
      bytes: Buffer.from("hello", "utf8"),
      downloadedFrom: "https://storage.example.com/object?signature=secret",
      contentType: "application/vnd.skillmarkdown.skill.v1+tar",
    }),
    installArtifact: async () => {},
    ...overrides,
  };
}

test("uses selected agent target over descriptor and default targets", async () => {
  const workflow = await installFromRegistry(
    baseInput({ selectedAgentTarget: "gemini" }),
    baseDependencies({
      getArtifactDescriptor: async () => ({
        owner: "@stefdevscore",
        username: "stefdevscore",
        skill: "test-skill",
        version: "1.2.3",
        digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        sizeBytes: 5,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        deprecated: false,
        deprecatedAt: null,
        deprecatedMessage: null,
        downloadUrl: "https://storage.example.com/object?signature=secret",
        downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        agentTarget: "claude",
      }),
    }),
  );

  assert.equal(workflow.result.agentTarget, "gemini");
  assert.match(workflow.result.installedPath, /\/\.gemini\/skills\//);
  assert.equal(
    workflow.lockEntry.sourceCommand,
    "skillmd use @stefdevscore/test-skill --agent-target gemini",
  );
});

test("falls back to descriptor agent target before default target", async () => {
  const workflow = await installFromRegistry(
    baseInput(),
    baseDependencies({
      getArtifactDescriptor: async () => ({
        owner: "@stefdevscore",
        username: "stefdevscore",
        skill: "test-skill",
        version: "1.2.3",
        digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        sizeBytes: 5,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        deprecated: false,
        deprecatedAt: null,
        deprecatedMessage: null,
        downloadUrl: "https://storage.example.com/object?signature=secret",
        downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        agentTarget: "claude",
      }),
    }),
  );

  assert.equal(workflow.result.agentTarget, "claude");
  assert.match(workflow.result.installedPath, /\/\.claude\/skills\//);
});

test("sanitizes downloadedFrom origin and preserves selector version in lock entry", async () => {
  const workflow = await installFromRegistry(
    baseInput({ selector: { strategy: "version", version: "2.0.1" } }),
    baseDependencies({
      getArtifactDescriptor: async () => ({
        owner: "@stefdevscore",
        username: "stefdevscore",
        skill: "test-skill",
        version: "2.0.1",
        digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        sizeBytes: 5,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        deprecated: false,
        deprecatedAt: null,
        deprecatedMessage: null,
        downloadUrl: "https://storage.example.com/object?signature=secret",
        downloadExpiresAt: "2026-03-02T12:40:00.000Z",
      }),
      downloadArtifact: async () => ({
        bytes: Buffer.from("hello", "utf8"),
        downloadedFrom: "not-a-valid-url",
        contentType: "application/vnd.skillmarkdown.skill.v1+tar",
      }),
    }),
  );

  assert.equal(workflow.lockEntry.selectorSpec, "2.0.1");
  assert.equal(workflow.lockEntry.downloadedFrom, "redacted");
  assert.equal(workflow.result.version, "2.0.1");
});

test("prefers bare skill ids for personal installs when requested", async () => {
  const workflow = await installFromRegistry(
    baseInput({
      username: "",
      preferBareSkillId: true,
      sourceCommandFactory: ({ canonicalSkillId }) => `skillmd use ${canonicalSkillId}`,
    }),
    baseDependencies({
      resolveVersion: async () => ({
        owner: "@stefdevscore",
        username: "stefdevscore",
        skill: "test-skill",
        spec: "latest",
        version: "1.2.3",
      }),
      getArtifactDescriptor: async () => ({
        owner: "@stefdevscore",
        username: "stefdevscore",
        skill: "test-skill",
        version: "1.2.3",
        digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        sizeBytes: 5,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        deprecated: false,
        deprecatedAt: null,
        deprecatedMessage: null,
        downloadUrl: "https://storage.example.com/object?signature=secret",
        downloadExpiresAt: "2026-03-02T12:40:00.000Z",
      }),
    }),
  );

  assert.equal(workflow.result.skillId, "test-skill");
  assert.equal(workflow.lockEntry.skillId, "test-skill");
  assert.equal(workflow.lockEntry.sourceCommand, "skillmd use test-skill");
});

test("keeps scoped org skill ids when install request is scoped", async () => {
  const workflow = await installFromRegistry(
    baseInput({
      username: "core",
      sourceCommandFactory: ({ canonicalSkillId }) => `skillmd use ${canonicalSkillId}`,
    }),
    baseDependencies({
      resolveVersion: async () => ({
        owner: "@core",
        username: "core",
        skill: "test-skill",
        spec: "latest",
        version: "1.2.3",
      }),
      getArtifactDescriptor: async () => ({
        owner: "@core",
        username: "core",
        skill: "test-skill",
        version: "1.2.3",
        digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        sizeBytes: 5,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        deprecated: false,
        deprecatedAt: null,
        deprecatedMessage: null,
        downloadUrl: "https://storage.example.com/object?signature=secret",
        downloadExpiresAt: "2026-03-02T12:40:00.000Z",
      }),
    }),
  );

  assert.equal(workflow.result.skillId, "@core/test-skill");
  assert.equal(workflow.lockEntry.skillId, "@core/test-skill");
  assert.equal(workflow.lockEntry.sourceCommand, "skillmd use @core/test-skill");
});

test("retries descriptor fetch with read token after auth failure", async () => {
  const descriptorTokens = [];
  let tokenResolutionCount = 0;
  const workflow = await installFromRegistry(
    baseInput({
      resolveReadIdToken: async () => {
        tokenResolutionCount += 1;
        return "id_token_123";
      },
    }),
    baseDependencies({
      getArtifactDescriptor: async (_baseUrl, _request, options) => {
        descriptorTokens.push(options?.idToken ?? null);
        if (!options?.idToken) {
          throw new UseApiError(403, "forbidden", "private skill access is not allowed", {
            reason: "forbidden_plan",
          });
        }
        return {
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object?signature=secret",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        };
      },
    }),
  );

  assert.equal(workflow.result.version, "1.2.3");
  assert.deepEqual(descriptorTokens, [null, "id_token_123"]);
  assert.equal(tokenResolutionCount, 1);
});

test("rejects artifact descriptor owner or skill drift", async () => {
  await assert.rejects(
    installFromRegistry(
      baseInput(),
      baseDependencies({
        getArtifactDescriptor: async () => ({
          owner: "@otherowner",
          username: "otherowner",
          skill: "other-skill",
          version: "1.2.3",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object?signature=secret",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
      }),
    ),
    /artifact descriptor identity mismatch/u,
  );
});

test("rejects artifact descriptor version drift", async () => {
  await assert.rejects(
    installFromRegistry(
      baseInput(),
      baseDependencies({
        getArtifactDescriptor: async () => ({
          owner: "@stefdevscore",
          username: "stefdevscore",
          skill: "test-skill",
          version: "9.9.9",
          digest: "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          sizeBytes: 5,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: "https://storage.example.com/object?signature=secret",
          downloadExpiresAt: "2026-03-02T12:40:00.000Z",
        }),
      }),
    ),
    /artifact descriptor version mismatch/u,
  );
});
