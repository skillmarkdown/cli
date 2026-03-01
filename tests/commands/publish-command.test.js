const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { PublishApiError } = requireDist("lib/publish/errors.js");
const { runPublishCommand } = requireDist("commands/publish.js");

function validArgs() {
  return ["--owner", "core", "--version", "1.0.0", "--dry-run"];
}

function validManifest() {
  return {
    schemaVersion: "skillmd.publish.v1",
    skillId: "core/publish-skill",
    owner: "core",
    skill: "publish-skill",
    version: "1.0.0",
    channel: "latest",
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
      email: "user@example.com",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown-development",
    }),
    getConfig: () => ({
      firebaseApiKey: "apikey",
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
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
      skillId: "core/publish-skill",
      version: "1.0.0",
      digest: "sha256:abc",
      channel: "latest",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runPublishCommand(["--owner", "core"]);
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
  const { result, errors } = await captureConsole(() => runPublishCommand(validArgs(), options));

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("fails on project mismatch with reauth guidance", async () => {
  const options = baseOptions({
    readSession: () => ({
      provider: "github",
      uid: "uid-1",
      refreshToken: "refresh-token",
      projectId: "skillmarkdown",
    }),
  });

  const { result, errors } = await captureConsole(() => runPublishCommand(validArgs(), options));
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

test("publishes successfully", async () => {
  const options = baseOptions();
  const { result, logs } = await captureConsole(() =>
    runPublishCommand(["--owner", "core", "--version", "1.0.0"], options),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Published core\/publish-skill@1.0.0/);
});

test("handles idempotent publish response", async () => {
  const options = baseOptions({
    preparePublish: async () => ({
      status: "idempotent",
      skillId: "core/publish-skill",
      version: "1.0.0",
      digest: "sha256:abc",
      channel: "latest",
    }),
  });

  const { result, logs } = await captureConsole(() =>
    runPublishCommand(["--owner", "core", "--version", "1.0.0"], options),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Already published/);
});

test("maps version conflict errors", async () => {
  const options = baseOptions({
    preparePublish: async () => {
      throw new PublishApiError(409, "version_conflict", "conflict");
    },
  });

  const { result, errors } = await captureConsole(() =>
    runPublishCommand(["--owner", "core", "--version", "1.0.0"], options),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /version conflict/i);
});
