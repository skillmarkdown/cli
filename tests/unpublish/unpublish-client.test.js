const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { unpublishVersion } = requireDist("lib/unpublish/client.js");
const { UnpublishApiError } = requireDist("lib/unpublish/errors.js");

test("unpublishVersion sends DELETE and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/@core/test-skill/versions/1.2.3");
      assert.equal(init.method, "DELETE");
      assert.match(String(init.headers.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        status: "unpublished",
        version: "1.2.3",
        tombstoned: true,
        removedTags: ["latest"],
        distTags: {
          beta: "2.0.0-beta.1",
        },
      });
    },
    () =>
      unpublishVersion("https://registry.example.com", "id-token", {
        username: "core",
        skillSlug: "test-skill",
        version: "1.2.3",
      }),
  );

  assert.equal(payload.status, "unpublished");
  assert.equal(payload.tombstoned, true);
  assert.equal(payload.distTags.beta, "2.0.0-beta.1");
});

test("unpublishVersion uses bare personal skill route when username is empty", async () => {
  await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/test-skill/versions/1.2.3");
      assert.equal(init.method, "DELETE");
      return mockJsonResponse(200, {
        status: "unpublished",
        version: "1.2.3",
        tombstoned: true,
        removedTags: ["latest"],
        distTags: {},
      });
    },
    () =>
      unpublishVersion("https://registry.example.com", "id-token", {
        username: "",
        skillSlug: "test-skill",
        version: "1.2.3",
      }),
  );
});

test("unpublish client maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(409, {
        error: {
          code: "unpublish_denied",
          message: "policy window elapsed",
        },
      }),
    async () => {
      await assert.rejects(
        unpublishVersion("https://registry.example.com", "id-token", {
          username: "core",
          skillSlug: "test-skill",
          version: "1.2.3",
        }),
        (error) => {
          assert.ok(error instanceof UnpublishApiError);
          assert.equal(error.status, 409);
          assert.equal(error.code, "unpublish_denied");
          return true;
        },
      );
    },
  );
});
