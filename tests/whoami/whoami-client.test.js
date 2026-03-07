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
        plan: "teams",
        entitlements: {
          canUsePrivateSkills: true,
          canPublishPrivateSkills: true,
        },
        teams: [{ team: "core-team", role: "owner" }],
      });
    },
    () => getWhoami("https://registry.example.com", "id-token"),
  );

  assert.equal(payload.uid, "uid-1");
  assert.equal(payload.owner, "@core");
  assert.equal(payload.plan, "teams");
  assert.equal(payload.teams[0].team, "core-team");
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
