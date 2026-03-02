const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { listSkillVersionHistory } = requireDist("lib/history/client.js");
const { HistoryApiError } = requireDist("lib/history/errors.js");

test("listSkillVersionHistory returns parsed response payload", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/stefdevscore/test-skill/versions");
      assert.equal(url.searchParams.get("limit"), "10");
      assert.equal(url.searchParams.get("cursor"), "next");
      assert.equal(init?.headers, undefined);

      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        limit: 10,
        results: [],
        nextCursor: null,
      });
    },
    () =>
      listSkillVersionHistory("https://registry.example.com", {
        ownerSlug: "stefdevscore",
        skillSlug: "test-skill",
        limit: 10,
        cursor: "next",
      }),
  );

  assert.equal(payload.ownerLogin, "stefdevscore");
  assert.equal(payload.limit, 10);
  assert.deepEqual(payload.results, []);
});

test("listSkillVersionHistory attaches bearer token when provided", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.match(String(init?.headers?.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        limit: 10,
        results: [],
        nextCursor: null,
      });
    },
    async () => {
      await listSkillVersionHistory(
        "https://registry.example.com",
        {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
          limit: 10,
        },
        { idToken: "token_123" },
      );
    },
  );
});

test("listSkillVersionHistory maps nested API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(400, {
        error: {
          code: "invalid_request",
          message: "bad cursor",
        },
        requestId: "req_123",
      }),
    async () => {
      await assert.rejects(
        listSkillVersionHistory("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
        }),
        (error) => {
          assert.ok(error instanceof HistoryApiError);
          assert.equal(error.status, 400);
          assert.equal(error.code, "invalid_request");
          return true;
        },
      );
    },
  );
});

test("listSkillVersionHistory rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        limit: 20,
        results: [],
      }),
    async () => {
      await assert.rejects(
        listSkillVersionHistory("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
        }),
        /missing required fields/i,
      );
    },
  );
});
