const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  mockJsonResponse,
  mockTextResponse,
  withMockedFetch,
} = require("../helpers/fetch-test-utils.js");

const { resolveSkillVersion, getArtifactDescriptor, downloadArtifact } =
  requireDist("lib/use/client.js");
const { UseApiError } = requireDist("lib/use/errors.js");

test("resolveSkillVersion returns parsed payload", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/stefdevscore/test-skill/resolve");
      assert.equal(url.searchParams.get("channel"), "latest");
      assert.equal(init?.headers, undefined);

      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        channel: "latest",
        version: "1.2.3",
      });
    },
    () =>
      resolveSkillVersion("https://registry.example.com", "stefdevscore", "test-skill", "latest"),
  );

  assert.equal(payload.version, "1.2.3");
});

test("resolveSkillVersion attaches bearer token when provided", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.match(String(init?.headers?.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        channel: "latest",
        version: "1.2.3",
      });
    },
    async () => {
      await resolveSkillVersion(
        "https://registry.example.com",
        "stefdevscore",
        "test-skill",
        "latest",
        { idToken: "token_123" },
      );
    },
  );
});

test("resolveSkillVersion rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        owner: "@stefdevscore",
      }),
    async () => {
      await assert.rejects(
        resolveSkillVersion("https://registry.example.com", "stefdevscore", "test-skill", "latest"),
        /missing required fields/i,
      );
    },
  );
});

test("getArtifactDescriptor returns parsed payload", async () => {
  const payload = await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/stefdevscore/test-skill/versions/1.2.3/artifact");
      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        version: "1.2.3",
        digest: "sha256:abc",
        sizeBytes: 3,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        yanked: false,
        yankedAt: null,
        yankedReason: null,
        downloadUrl: "https://storage.example.com/object",
        downloadExpiresAt: "2026-03-02T12:00:00.000Z",
      });
    },
    () =>
      getArtifactDescriptor("https://registry.example.com", {
        ownerSlug: "stefdevscore",
        skillSlug: "test-skill",
        version: "1.2.3",
      }),
  );

  assert.equal(payload.downloadUrl, "https://storage.example.com/object");
});

test("downloadArtifact returns bytes and content type", async () => {
  const payload = await withMockedFetch(
    async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return String(name).toLowerCase() === "content-type"
            ? "application/vnd.skillmarkdown.skill.v1+tar"
            : null;
        },
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }),
    () => downloadArtifact("https://storage.example.com/object"),
  );

  assert.equal(payload.bytes.length, 3);
  assert.equal(payload.downloadedFrom, "https://storage.example.com");
  assert.equal(payload.contentType, "application/vnd.skillmarkdown.skill.v1+tar");
});

test("downloadArtifact redacts signed URL path and query details", async () => {
  const payload = await withMockedFetch(
    async () => ({
      ok: true,
      status: 200,
      headers: {
        get() {
          return null;
        },
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }),
    () =>
      downloadArtifact(
        "https://storage.googleapis.com/skillmarkdown-development.firebasestorage.app/skills/o0npTAUjw5OEnnL966flwJUoQdM2/test-skill/1.0.0/sha256%3Aabc.tgz?X-Goog-Signature=secret",
      ),
  );

  assert.equal(payload.downloadedFrom, "https://storage.googleapis.com");
});

test("maps API errors into UseApiError", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(400, {
        error: {
          code: "invalid_request",
          message: "version not found",
        },
      }),
    async () => {
      await assert.rejects(
        getArtifactDescriptor("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
          version: "9.9.9",
        }),
        (error) => {
          assert.ok(error instanceof UseApiError);
          assert.equal(error.status, 400);
          assert.equal(error.code, "invalid_request");
          return true;
        },
      );
    },
  );
});

test("rejects malformed artifact descriptor payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        owner: "@stefdevscore",
      }),
    async () => {
      await assert.rejects(
        getArtifactDescriptor("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
          version: "1.2.3",
        }),
        /missing required fields/i,
      );
    },
  );
});

test("downloadArtifact fails on non-2xx responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(403, "forbidden"),
    async () => {
      await assert.rejects(downloadArtifact("https://storage.example.com/object"), /failed/);
    },
  );
});

test("getArtifactDescriptor reports non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(502, "<html>bad gateway</html>"),
    async () => {
      await assert.rejects(
        getArtifactDescriptor("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
          version: "1.2.3",
        }),
        /non-JSON/i,
      );
    },
  );
});
