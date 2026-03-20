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
      assert.equal(url.pathname, "/v1/skills/@acme/test-skill/dist-tags");
      return mockJsonResponse(200, {
        owner: "@owner",
        username: "acme",
        skill: "test-skill",
        distTags: { latest: "1.2.3" },
        updatedAt: "2026-03-03T12:00:00.000Z",
      });
    },
    () =>
      listDistTags("https://registry.example.com", {
        username: "acme",
        skillSlug: "test-skill",
      }),
  );

  assert.equal(payload.username, "acme");
  assert.equal(payload.distTags.latest, "1.2.3");
});

test("listDistTags uses bare personal skill route when username is empty", async () => {
  await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/test-skill/dist-tags");
      return mockJsonResponse(200, {
        owner: "@test",
        username: "test",
        skill: "test-skill",
        distTags: { latest: "1.2.3" },
        updatedAt: "2026-03-03T12:00:00.000Z",
      });
    },
    () =>
      listDistTags("https://registry.example.com", {
        username: "",
        skillSlug: "test-skill",
      }),
  );
});

test("listDistTags surfaces strict route errors without fallback", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(404, {
        error: {
          code: "invalid_request",
          message: "route not found",
        },
      }),
    async () => {
      await assert.rejects(
        listDistTags("https://registry.example.com", {
          username: "acme",
          skillSlug: "test-skill",
        }),
        (error) => {
          assert.ok(error instanceof TagApiError);
          assert.equal(error.status, 404);
          assert.equal(error.code, "invalid_request");
          assert.match(error.message, /route not found/i);
          return true;
        },
      );
    },
  );
});

test("setDistTag sends PUT payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/@acme/test-skill/dist-tags/beta");
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
        username: "acme",
        skillSlug: "test-skill",
        tag: "beta",
        version: "1.2.3",
      }),
  );

  assert.equal(payload.status, "updated");
  assert.equal(payload.distTags.beta, "1.2.3");
});

test("setDistTag uses bare personal skill route when username is empty", async () => {
  await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/test-skill/dist-tags/beta");
      assert.equal(init.method, "PUT");
      return mockJsonResponse(200, {
        status: "updated",
        tag: "beta",
        version: "1.2.3",
        distTags: { beta: "1.2.3" },
      });
    },
    () =>
      setDistTag("https://registry.example.com", "id-token", {
        username: "",
        skillSlug: "test-skill",
        tag: "beta",
        version: "1.2.3",
      }),
  );
});

test("removeDistTag sends DELETE and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/@acme/test-skill/dist-tags/beta");
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
        username: "acme",
        skillSlug: "test-skill",
        tag: "beta",
      }),
  );

  assert.equal(payload.status, "deleted");
  assert.equal(payload.distTags.latest, "1.2.2");
});

test("removeDistTag uses bare personal skill route when username is empty", async () => {
  await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/test-skill/dist-tags/beta");
      assert.equal(init.method, "DELETE");
      return mockJsonResponse(200, {
        status: "deleted",
        tag: "beta",
        distTags: { latest: "1.2.2" },
      });
    },
    () =>
      removeDistTag("https://registry.example.com", "id-token", {
        username: "",
        skillSlug: "test-skill",
        tag: "beta",
      }),
  );
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
          username: "username",
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

test("listDistTags normalizes non-string distTag values out of the payload", async () => {
  const payload = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        owner: "@owner",
        username: "username",
        skill: "test-skill",
        distTags: { latest: "1.2.3", beta: 42, old: null },
        updatedAt: "2026-03-03T12:00:00.000Z",
      }),
    () =>
      listDistTags("https://registry.example.com", {
        username: "username",
        skillSlug: "test-skill",
      }),
  );

  assert.deepEqual(payload.distTags, { latest: "1.2.3" });
});

test("setDistTag rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        status: "updated",
        tag: "beta",
      }),
    async () => {
      await assert.rejects(
        setDistTag("https://registry.example.com", "id-token", {
          username: "username",
          skillSlug: "test-skill",
          tag: "beta",
          version: "1.2.3",
        }),
        /missing required fields/i,
      );
    },
  );
});

test("removeDistTag rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        status: "deleted",
        distTags: {},
      }),
    async () => {
      await assert.rejects(
        removeDistTag("https://registry.example.com", "id-token", {
          username: "username",
          skillSlug: "test-skill",
          tag: "beta",
        }),
        /missing required fields/i,
      );
    },
  );
});
