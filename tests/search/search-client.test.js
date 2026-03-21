const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { searchSkills } = requireDist("lib/search/client.js");
const { SearchApiError } = requireDist("lib/search/errors.js");

test("searchSkills returns parsed response payload", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/search");
      assert.equal(url.searchParams.get("q"), "agent");
      assert.equal(url.searchParams.get("limit"), "10");
      assert.equal(url.searchParams.get("cursor"), "next");
      assert.equal(url.searchParams.get("scope"), null);
      assert.equal(init?.headers, undefined);

      return mockJsonResponse(200, {
        query: "agent",
        limit: 10,
        results: [],
        nextCursor: null,
      });
    },
    () =>
      searchSkills("https://registry.example.com", {
        query: "agent",
        limit: 10,
        cursor: "next",
      }),
  );

  assert.equal(payload.query, "agent");
  assert.equal(payload.limit, 10);
  assert.deepEqual(payload.results, []);
});

test("searchSkills sends private scope and bearer token when provided", async () => {
  await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/search");
      assert.equal(url.searchParams.get("scope"), "private");
      assert.match(String(init?.headers?.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        query: "agent",
        limit: 5,
        results: [],
        nextCursor: null,
      });
    },
    async () => {
      const payload = await searchSkills(
        "https://registry.example.com",
        {
          query: "agent",
          limit: 5,
          scope: "private",
        },
        { idToken: "token_123" },
      );
      assert.equal(payload.limit, 5);
    },
  );
});

test("searchSkills sends match when provided", async () => {
  await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("q"), "se");
      assert.equal(url.searchParams.get("scope"), "public");
      assert.equal(url.searchParams.get("match"), "id");
      return mockJsonResponse(200, {
        query: "se",
        limit: 5,
        results: [],
        nextCursor: null,
      });
    },
    async () => {
      const payload = await searchSkills("https://registry.example.com", {
        query: "se",
        limit: 5,
        scope: "public",
        match: "id",
      });
      assert.equal(payload.query, "se");
    },
  );
});

test("searchSkills maps nested API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(400, {
        error: {
          code: "invalid_request",
          message: "bad query",
        },
        requestId: "req_123",
      }),
    async () => {
      await assert.rejects(
        searchSkills("https://registry.example.com", {
          query: "a b",
        }),
        (error) => {
          assert.ok(error instanceof SearchApiError);
          assert.equal(error.status, 400);
          assert.equal(error.code, "invalid_request");
          return true;
        },
      );
    },
  );
});

test("searchSkills rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        limit: 20,
        results: [],
      }),
    async () => {
      await assert.rejects(
        searchSkills("https://registry.example.com", {}),
        /missing required fields/i,
      );
    },
  );
});

test("searchSkills defaults missing distTags to empty map", async () => {
  const payload = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        query: "agent",
        limit: 20,
        results: [
          {
            skillId: "test-skill",
            owner: "@owner",
            username: "username",
            skill: "test-skill",
            description: "desc",
            updatedAt: "2026-03-03T10:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
    () => searchSkills("https://registry.example.com", {}),
  );

  assert.deepEqual(payload.results[0].distTags, {});
});

test("searchSkills normalizes mixed distTags values and omits empty query params", async () => {
  const payload = await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("q"), null);
      assert.equal(url.searchParams.get("limit"), null);
      assert.equal(url.searchParams.get("cursor"), null);
      return mockJsonResponse(200, {
        query: null,
        limit: 20,
        results: [
          {
            skillId: "test-skill",
            owner: "@owner",
            username: "username",
            skill: "test-skill",
            description: "desc",
            distTags: { latest: "1.0.0", invalid: 5, old: null },
            updatedAt: "2026-03-03T10:00:00.000Z",
          },
          null,
        ],
        nextCursor: null,
      });
    },
    () => searchSkills("https://registry.example.com", {}),
  );

  assert.deepEqual(payload.results[0].distTags, { latest: "1.0.0" });
  assert.equal(payload.results[1], null);
});
