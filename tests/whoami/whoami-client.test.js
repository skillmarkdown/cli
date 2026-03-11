const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { WhoamiApiError } = requireDist("lib/whoami/errors.js");
const { getWhoami } = requireDist("lib/whoami/client.js");

test("getWhoami sends auth header and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/auth/whoami");
      assert.equal(init.method, "GET");
      assert.match(String(init.headers.Authorization), /^Bearer /);
      return mockJsonResponse(200, {
        uid: "uid-1",
        owner: "@core",
        username: "core",
        email: "core@example.com",
        projectId: "skillmarkdown-development",
        authType: "firebase",
        scope: "admin",
        organizations: [
          {
            slug: "facebook",
            owner: "@facebook",
            role: "admin",
          },
        ],
        organizationTeams: [
          {
            organizationSlug: "facebook",
            teamSlug: "core",
          },
        ],
        plan: "pro",
        entitlements: {
          canUsePrivateSkills: true,
          canPublishPrivateSkills: true,
        },
      });
    },
    () => getWhoami("https://registry.example.com", "id-token"),
  );

  assert.equal(payload.uid, "uid-1");
  assert.equal(payload.owner, "@core");
  assert.equal(payload.organizations[0].slug, "facebook");
  assert.equal(payload.organizationTeams[0].teamSlug, "core");
  assert.equal(payload.plan, "pro");
});

test("getWhoami maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(401, {
        error: {
          code: "unauthorized",
          message: "invalid token",
        },
      }),
    async () => {
      await assert.rejects(getWhoami("https://registry.example.com", "id-token"), (error) => {
        assert.ok(error instanceof WhoamiApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "unauthorized");
        return true;
      });
    },
  );
});
