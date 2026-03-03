const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { TagApiError } = requireDist("lib/tag/errors.js");
const { listDistTags, removeDistTag, setDistTag } = requireDist("lib/tag/client.js");

test("listDistTags returns parsed payload", async () => {
  const payload = await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/owner/test-skill/dist-tags");
      return mockJsonResponse(200, {
        owner: "@owner",
        ownerLogin: "owner",
        skill: "test-skill",
        distTags: { latest: "1.2.3" },
        updatedAt: "2026-03-03T12:00:00.000Z",
      });
    },
    () =>
      listDistTags("https://registry.example.com", {
        ownerSlug: "owner",
        skillSlug: "test-skill",
      }),
  );

  assert.equal(payload.ownerLogin, "owner");
  assert.equal(payload.distTags.latest, "1.2.3");
});

test("listDistTags falls back to skill view when dist-tags route is unavailable", async () => {
  let fetchCount = 0;
  const payload = await withMockedFetch(
    async (input) => {
      fetchCount += 1;
      const url = new URL(String(input));
      if (fetchCount === 1) {
        assert.equal(url.pathname, "/v1/skills/owner/test-skill/dist-tags");
        return mockJsonResponse(404, {
          error: {
            code: "invalid_request",
            message: "route not found",
          },
        });
      }

      assert.equal(url.pathname, "/v1/skills/owner/test-skill");
      return mockJsonResponse(200, {
        owner: "@owner",
        ownerLogin: "owner",
        skill: "test-skill",
        description: "desc",
        access: "public",
        distTags: { latest: "2.0.0", beta: "2.1.0-beta.1" },
        updatedAt: "2026-03-03T12:30:00.000Z",
      });
    },
    () =>
      listDistTags("https://registry.example.com", {
        ownerSlug: "owner",
        skillSlug: "test-skill",
      }),
  );

  assert.equal(fetchCount, 2);
  assert.equal(payload.ownerLogin, "owner");
  assert.equal(payload.distTags.latest, "2.0.0");
  assert.equal(payload.distTags.beta, "2.1.0-beta.1");
});

test("setDistTag sends PUT payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/owner/test-skill/dist-tags/beta");
      assert.equal(init.method, "PUT");
      assert.match(String(init.headers.Authorization), /^Bearer /);
      assert.deepEqual(JSON.parse(String(init.body)), { version: "1.2.3" });
      return mockJsonResponse(200, {
        status: "updated",
        tag: "beta",
        version: "1.2.3",
        distTags: { latest: "1.2.2", beta: "1.2.3" },
      });
    },
    () =>
      setDistTag("https://registry.example.com", "id-token", {
        ownerSlug: "owner",
        skillSlug: "test-skill",
        tag: "beta",
        version: "1.2.3",
      }),
  );

  assert.equal(payload.status, "updated");
  assert.equal(payload.distTags.beta, "1.2.3");
});

test("removeDistTag sends DELETE and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/owner/test-skill/dist-tags/beta");
      assert.equal(init.method, "DELETE");
      assert.match(String(init.headers.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        status: "deleted",
        tag: "beta",
        distTags: { latest: "1.2.2" },
      });
    },
    () =>
      removeDistTag("https://registry.example.com", "id-token", {
        ownerSlug: "owner",
        skillSlug: "test-skill",
        tag: "beta",
      }),
  );

  assert.equal(payload.status, "deleted");
  assert.equal(payload.distTags.latest, "1.2.2");
});

test("tag client maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(404, {
        error: {
          code: "not_found",
          message: "skill not found",
        },
      }),
    async () => {
      await assert.rejects(
        listDistTags("https://registry.example.com", {
          ownerSlug: "owner",
          skillSlug: "missing",
        }),
        (error) => {
          assert.ok(error instanceof TagApiError);
          assert.equal(error.status, 404);
          assert.equal(error.code, "not_found");
          return true;
        },
      );
    },
  );
});
