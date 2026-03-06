const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { PublishApiError } = requireDist("lib/publish/errors.js");
const { runPublishCommand } = requireDist("commands/publish.js");
const { MAX_PUBLISH_MANIFEST_SIZE_BYTES } = requireDist("lib/publish/types.js");

function validArgs() {
  return ["--version", "1.0.0", "--dry-run"];
}

function validManifest() {
  return {
    schemaVersion: "skillmd.publish.v1",
    skill: "publish-skill",
    version: "1.0.0",
    tag: "latest",
    access: "public",
    provenance: false,
    digest: "sha256:abc",
    sizeBytes: 123,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    files: [],
  };
}

function packedArtifact() {
  return {
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    tarGz: Buffer.from("archive"),
    digest: "sha256:abc",
    sizeBytes: 123,
    files: [],
  };
}

function baseOptions(overrides = {}) {
  return {
    cwd: "/tmp/publish-skill",
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "apikey",
      SKILLMD_GITHUB_CLIENT_ID: "gh",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
    },
    validateSkill: () => ({ status: "passed", message: "ok" }),
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      email: "user@example.com",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown-development",
    }),
    getConfig: () => ({
      firebaseApiKey: "apikey",
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
      defaultAgentTarget: "skillmd",
    }),
    packArtifact: () => packedArtifact(),
    buildManifest: () => validManifest(),
    exchangeRefreshToken: async () => ({
      idToken: "id-token",
      userId: "uid-1",
      expiresInSeconds: 3600,
    }),
    preparePublish: async () => ({
      status: "upload_required",
      publishToken: "pub-token",
      uploadUrl: "https://upload.example.com/object",
      uploadMethod: "PUT",
    }),
    uploadArtifact: async () => {},
    commitPublish: async () => ({
      status: "published",
      skillId: "@core/publish-skill",
      version: "1.0.0",
      tag: "latest",
      distTags: { latest: "1.0.0" },
      provenance: { requested: false, recorded: false },
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runPublishCommand([]);
  assert.equal(exitCode, 1);
});

test("fails when strict validation fails", async () => {
  const options = baseOptions({
    validateSkill: () => ({ status: "failed", message: "bad skill" }),
  });

  const { result } = await captureConsole(() => runPublishCommand(validArgs(), options));
  assert.equal(result, 1);
});

test("fails when not logged in", async () => {
  const options = baseOptions({ readSession: () => null });
  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("fails when session has no github username", async () => {
  const options = baseOptions({
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown-development",
    }),
  });
  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /login --reauth/i);
});

test("uses configured auth token for publish without session", async () => {
  let exchangeCalled = false;
  let prepareToken = null;
  const options = baseOptions({
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "apikey",
      SKILLMD_GITHUB_CLIENT_ID: "gh",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
    },
    readSession: () => null,
    exchangeRefreshToken: async () => {
      exchangeCalled = true;
      return {
        idToken: "id-token",
        userId: "uid-1",
        expiresInSeconds: 3600,
      };
    },
    preparePublish: async (_baseUrl, idToken) => {
      prepareToken = idToken;
      return {
        status: "idempotent",
        publishToken: "pit-token",
        expiresAt: "2026-03-02T00:00:00Z",
      };
    },
  });

  const { result } = await captureConsole(() => runPublishCommand(["--version", "1.0.0"], options));

  assert.equal(result, 0);
  assert.equal(exchangeCalled, false);
  assert.equal(prepareToken, "skmd_dev_tok_abc123abc123abc123abc123.secret");
});

test("fails on project mismatch with reauth guidance", async () => {
  const options = baseOptions({
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown",
    }),
  });

  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /login --reauth/);
});

test("dry-run performs local checks only", async () => {
  let exchanged = false;
  let prepared = false;

  const options = baseOptions({
    exchangeRefreshToken: async () => {
      exchanged = true;
      return { idToken: "id-token", userId: "uid-1", expiresInSeconds: 3600 };
    },
    preparePublish: async () => {
      prepared = true;
      return {
        status: "upload_required",
        publishToken: "pub-token",
        uploadUrl: "https://upload.example.com/object",
      };
    },
  });

  const { result, logs } = await captureConsole(() => runPublishCommand(validArgs(), options));
  assert.equal(result, 0);
  assert.equal(exchanged, false);
  assert.equal(prepared, false);
  assert.match(logs.join("\n"), /dry-run/i);
});

test("dry-run succeeds without session or auth token", async () => {
  const options = baseOptions({
    readSession: () => null,
    exchangeRefreshToken: async () => {
      throw new Error("should not exchange refresh token for dry-run");
    },
    preparePublish: async () => {
      throw new Error("should not call publish API for dry-run");
    },
  });

  const { result, logs } = await captureConsole(() => runPublishCommand(validArgs(), options));
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /dry-run/i);
});

test("dry-run ignores session project mismatch", async () => {
  const options = baseOptions({
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown",
    }),
  });

  const { result, logs, errors } = await captureConsole(() =>
    runPublishCommand(validArgs(), options),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /dry-run/i);
  assert.equal(errors.length, 0);
});

test("publishes successfully", async () => {
  const options = baseOptions();
  const { result, logs } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Published @core\/publish-skill@1.0.0/);
});

test("handles idempotent publish response", async () => {
  const options = baseOptions({
    preparePublish: async () => ({
      status: "idempotent",
      publishToken: "pit-token",
      expiresAt: "2026-03-02T00:00:00Z",
    }),
    commitPublish: async () => ({
      status: "idempotent",
      skillId: "@core/publish-skill",
      version: "1.0.0",
      tag: "latest",
      distTags: { latest: "1.0.0" },
      agentTarget: "skillmd",
      provenance: { requested: false, recorded: false },
    }),
  });

  const { result, logs } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Already published/);
});

test("commits idempotent prepare responses without uploading artifact", async () => {
  let uploadCalled = false;
  let commitCalled = false;

  const options = baseOptions({
    preparePublish: async () => ({
      status: "idempotent",
      publishToken: "pit-token",
      expiresAt: "2026-03-02T00:00:00Z",
    }),
    uploadArtifact: async () => {
      uploadCalled = true;
    },
    commitPublish: async (_baseUrl, _idToken, payload) => {
      commitCalled = true;
      assert.equal(payload.publishToken, "pit-token");
      return {
        status: "idempotent",
        skillId: "@core/publish-skill",
        version: "1.0.0",
        tag: "stable",
        distTags: { latest: "1.0.0", stable: "1.0.0" },
        agentTarget: "skillmd",
        provenance: { requested: false, recorded: false },
      };
    },
  });

  const { result, logs } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0", "--tag", "stable"], options),
  );

  assert.equal(result, 0);
  assert.equal(uploadCalled, false);
  assert.equal(commitCalled, true);
  assert.match(logs.join("\n"), /Already published @core\/publish-skill@1.0.0 \(tag: stable/);
});

test("maps version conflict errors", async () => {
  const options = baseOptions({
    preparePublish: async () => {
      throw new PublishApiError(409, "version_conflict", "conflict");
    },
  });

  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /version conflict/i);
});

test("includes request id in publish API error output when available", async () => {
  const options = baseOptions({
    preparePublish: async () => {
      throw new PublishApiError(500, "internal_error", "unexpected error", {
        requestId: "req_12345",
      });
    },
  });

  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0"], options),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /request req_12345/i);
});

test("forwards --access and --provenance to prepare payload", async () => {
  let capturedAccess;
  let capturedProvenance;
  const options = baseOptions({
    preparePublish: async (_baseUrl, _idToken, payload) => {
      capturedAccess = payload.access;
      capturedProvenance = payload.provenance;
      return {
        status: "idempotent",
        publishToken: "pit-token",
        expiresAt: "2026-03-02T00:00:00Z",
      };
    },
  });

  const { result } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0", "--access", "private", "--provenance"], options),
  );

  assert.equal(result, 0);
  assert.equal(capturedAccess, "private");
  assert.equal(capturedProvenance, true);
});

test("forwards --agent-target to prepare payload", async () => {
  let capturedTarget;
  const options = baseOptions({
    preparePublish: async (_baseUrl, _idToken, payload) => {
      capturedTarget = payload.agentTarget;
      return {
        status: "idempotent",
        publishToken: "pit-token",
        expiresAt: "2026-03-02T00:00:00Z",
      };
    },
  });

  const { result } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0", "--agent-target", "claude"], options),
  );

  assert.equal(result, 0);
  assert.equal(capturedTarget, "claude");
});

test("forwards repository and homepage package metadata when present", async () => {
  let capturedPackageMeta = null;
  const options = baseOptions({
    buildManifest: () => ({
      ...validManifest(),
      repository: "https://github.com/skillmarkdown/cli",
      homepage: "https://github.com/skillmarkdown/cli#readme",
      license: "MIT",
    }),
    preparePublish: async (_baseUrl, _idToken, payload) => {
      capturedPackageMeta = payload.packageMeta;
      return {
        status: "idempotent",
        publishToken: "pit-token",
        expiresAt: "2026-03-02T00:00:00Z",
      };
    },
  });

  const { result } = await captureConsole(() => runPublishCommand(["--version", "1.0.0"], options));

  assert.equal(result, 0);
  assert.equal(capturedPackageMeta?.repository, "https://github.com/skillmarkdown/cli");
  assert.equal(capturedPackageMeta?.homepage, "https://github.com/skillmarkdown/cli#readme");
  assert.equal(capturedPackageMeta?.license, "MIT");
  assert.equal(capturedPackageMeta?.unpackedSizeBytes, 0);
  assert.equal(capturedPackageMeta?.totalFiles, 0);
});

test("fails when manifest exceeds configured max size", async () => {
  const options = baseOptions({
    buildManifest: () => ({
      ...validManifest(),
      description: "x".repeat(MAX_PUBLISH_MANIFEST_SIZE_BYTES + 1),
    }),
  });

  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--version", "1.0.0", "--dry-run"], options),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /manifest exceeds max size/i);
});
