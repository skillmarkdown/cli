const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  mockJsonResponse,
  mockTextResponse,
  withMockedFetch,
} = require("../helpers/fetch-test-utils.js");

const { PublishApiError } = requireDist("lib/publish/errors.js");
const { commitPublish, preparePublish, uploadArtifact } = requireDist("lib/publish/client.js");

function preparePayload() {
  return {
    skill: "publish-skill",
    version: "1.0.0",
    tag: "latest",
    access: "public",
    provenance: false,
    packageMeta: {
      name: "publish-skill",
      version: "1.0.0",
      description: "publish skill",
    },
    digest: "sha256:abc",
    sizeBytes: 42,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    manifest: {
      schemaVersion: "skillmd.publish.v1",
      skill: "publish-skill",
      version: "1.0.0",
      tag: "latest",
      access: "public",
      provenance: false,
      digest: "sha256:abc",
      sizeBytes: 42,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      files: [],
    },
  };
}

test("preparePublish returns upload_required payload", async () => {
  const result = await withMockedFetch(
    async (input, init) => {
      assert.match(String(input), /\/v1\/publish\/prepare$/);
      assert.match(String(init.headers.Authorization), /^Bearer /);
      const parsedBody = JSON.parse(String(init.body));
      assert.equal(parsedBody.tag, "latest");
      assert.equal(parsedBody.access, "public");
      assert.equal(parsedBody.provenance, false);
      assert.equal(parsedBody.packageMeta.name, "publish-skill");
      return mockJsonResponse(200, {
        status: "upload_required",
        publishToken: "pub-token",
        uploadUrl: "https://upload.example.com/object",
      });
    },
    () => preparePublish("https://registry.example.com", "id-token", preparePayload()),
  );

  assert.deepEqual(result, {
    status: "upload_required",
    publishToken: "pub-token",
    uploadUrl: "https://upload.example.com/object",
  });
});

test("preparePublish returns idempotent payload", async () => {
  const result = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        status: "idempotent",
        publishToken: "pit-token",
        expiresAt: "2026-03-02T00:00:00Z",
      }),
    () => preparePublish("https://registry.example.com", "id-token", preparePayload()),
  );

  assert.equal(result.status, "idempotent");
  assert.equal(result.publishToken, "pit-token");
});

test("preparePublish maps API errors", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(409, { code: "version_conflict", message: "Conflict" }),
    async () => {
      await assert.rejects(
        preparePublish("https://registry.example.com", "id-token", preparePayload()),
        (error) => {
          assert.ok(error instanceof PublishApiError);
          assert.equal(error.status, 409);
          assert.equal(error.code, "version_conflict");
          return true;
        },
      );
    },
  );
});

test("preparePublish rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        status: "upload_required",
        publishToken: "pub-token",
      }),
    async () => {
      await assert.rejects(
        preparePublish("https://registry.example.com", "id-token", preparePayload()),
        /missing required fields/i,
      );
    },
  );
});

test("uploadArtifact uploads with content-type header", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.equal(init.method, "PUT");
      assert.equal(init.headers.get("Content-Type"), "application/x-test");
      return mockTextResponse(200, "ok");
    },
    async () => {
      await uploadArtifact(
        "https://upload.example.com/object",
        Buffer.from("content"),
        "application/x-test",
      );
    },
  );
});

test("uploadArtifact preserves explicit content-type and custom headers", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.get("Content-Type"), "application/custom");
      assert.equal(init.headers.get("x-upload-token"), "abc123");
      return mockTextResponse(201, "created");
    },
    async () => {
      await uploadArtifact(
        "https://upload.example.com/object",
        Buffer.from("content"),
        "application/x-test",
        "POST",
        { "Content-Type": "application/custom", "x-upload-token": "abc123" },
      );
    },
  );
});

test("commitPublish returns published response", async () => {
  const result = await withMockedFetch(
    async (input) => {
      assert.match(String(input), /\/v1\/publish\/commit$/);
      return mockJsonResponse(200, {
        status: "published",
        skillId: "@core/publish-skill",
        version: "1.0.0",
        tag: "latest",
        distTags: { latest: "1.0.0" },
        provenance: { requested: false, recorded: false },
      });
    },
    () =>
      commitPublish("https://registry.example.com", "id-token", {
        publishToken: "pub-token",
      }),
  );

  assert.equal(result.status, "published");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.tag, "latest");
});

test("commitPublish accepts idempotent response", async () => {
  const result = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        status: "idempotent",
        skillId: "@core/publish-skill",
        version: "1.0.0",
        tag: "latest",
        distTags: { latest: "1.0.0" },
        provenance: { requested: false, recorded: false },
      }),
    () =>
      commitPublish("https://registry.example.com", "id-token", {
        publishToken: "pub-token",
      }),
  );

  assert.equal(result.status, "idempotent");
});

test("commitPublish rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        status: "published",
        skillId: "@core/publish-skill",
        version: "1.0.0",
      }),
    async () => {
      await assert.rejects(
        commitPublish("https://registry.example.com", "id-token", {
          publishToken: "pub-token",
        }),
        /missing required fields/i,
      );
    },
  );
});
