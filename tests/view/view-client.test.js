const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { getSkillView } = requireDist("lib/view/client.js");
const { ViewApiError } = requireDist("lib/view/errors.js");

test("getSkillView returns parsed response payload", async () => {
  const payload = await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/owner/test-skill");
      return mockJsonResponse(200, {
        owner: "@owner",
        username: "owner",
        skill: "test-skill",
        description: "desc",
        access: "public",
        distTags: {
          latest: "1.2.3",
        },
        updatedAt: "2026-03-02T12:00:00.000Z",
      });
    },
    () =>
      getSkillView("https://registry.example.com", {
        username: "owner",
        skillSlug: "test-skill",
      }),
  );

  assert.equal(payload.skill, "test-skill");
  assert.equal(payload.distTags.latest, "1.2.3");
});

test("getSkillView attaches bearer token when provided", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.match(String(init?.headers?.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        owner: "@owner",
        username: "owner",
        skill: "test-skill",
        description: "desc",
        access: "private",
        distTags: {
          latest: "1.2.3",
        },
        updatedAt: "2026-03-02T12:00:00.000Z",
      });
    },
    async () => {
      await getSkillView(
        "https://registry.example.com",
        {
          username: "owner",
          skillSlug: "test-skill",
        },
        { idToken: "token_123" },
      );
    },
  );
});

test("getSkillView maps API errors", async () => {
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
        getSkillView("https://registry.example.com", {
          username: "owner",
          skillSlug: "missing",
        }),
        (error) => {
          assert.ok(error instanceof ViewApiError);
          assert.equal(error.status, 404);
          assert.equal(error.code, "not_found");
          return true;
        },
      );
    },
  );
});
