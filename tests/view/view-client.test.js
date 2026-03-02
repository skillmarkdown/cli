const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { getSkillView } = requireDist("lib/view/client.js");
const { ViewApiError } = requireDist("lib/view/errors.js");

test("getSkillView returns parsed response payload", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/stefdevscore/test-skill");
      assert.equal(init?.headers, undefined);

      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        description: "sample",
        visibility: "public",
        channels: {
          latest: "1.0.0",
        },
        updatedAt: "2026-03-02T09:00:00.000Z",
      });
    },
    () =>
      getSkillView("https://registry.example.com", {
        ownerSlug: "stefdevscore",
        skillSlug: "test-skill",
      }),
  );

  assert.equal(payload.ownerLogin, "stefdevscore");
  assert.equal(payload.skill, "test-skill");
});

test("getSkillView attaches bearer token when provided", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.match(String(init?.headers?.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        owner: "@stefdevscore",
        ownerLogin: "stefdevscore",
        skill: "test-skill",
        description: "sample",
        visibility: "private",
        channels: {
          latest: "1.0.0",
        },
        updatedAt: "2026-03-02T09:00:00.000Z",
      });
    },
    async () => {
      await getSkillView(
        "https://registry.example.com",
        {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
        },
        { idToken: "token_123" },
      );
    },
  );
});

test("getSkillView maps nested API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(404, {
        error: {
          code: "invalid_request",
          message: "skill not found",
        },
      }),
    async () => {
      await assert.rejects(
        getSkillView("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "missing",
        }),
        (error) => {
          assert.ok(error instanceof ViewApiError);
          assert.equal(error.status, 404);
          assert.equal(error.code, "invalid_request");
          return true;
        },
      );
    },
  );
});

test("getSkillView rejects malformed success payloads", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        owner: "@stefdevscore",
        skill: "test-skill",
      }),
    async () => {
      await assert.rejects(
        getSkillView("https://registry.example.com", {
          ownerSlug: "stefdevscore",
          skillSlug: "test-skill",
        }),
        /missing required fields/i,
      );
    },
  );
});
