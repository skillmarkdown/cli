const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { deprecateVersions } = requireDist("lib/deprecate/client.js");
const { DeprecateApiError } = requireDist("lib/deprecate/errors.js");

test("deprecateVersions sends POST body and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/@core/test-skill/deprecations");
      assert.equal(init.method, "POST");
      assert.equal(init.headers["Content-Type"], "application/json");
      assert.match(String(init.headers.Authorization), /^Bearer /);
      assert.deepEqual(JSON.parse(init.body), {
        range: "^1.2.0",
        message: "Use 2.x",
      });
      return mockJsonResponse(200, {
        status: "updated",
        range: "^1.2.0",
        affectedVersions: ["1.2.0", "1.2.1"],
        message: "Use 2.x",
      });
    },
    () =>
      deprecateVersions("https://registry.example.com", "id-token", {
        username: "core",
        skillSlug: "test-skill",
        range: "^1.2.0",
        message: "Use 2.x",
      }),
  );

  assert.equal(payload.status, "updated");
  assert.deepEqual(payload.affectedVersions, ["1.2.0", "1.2.1"]);
});

test("deprecateVersions uses bare personal skill route when username is empty", async () => {
  await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/skills/test-skill/deprecations");
      assert.equal(init.method, "POST");
      return mockJsonResponse(200, {
        status: "updated",
        range: "^1.2.0",
        affectedVersions: ["1.2.0"],
        message: "Use 2.x",
      });
    },
    () =>
      deprecateVersions("https://registry.example.com", "id-token", {
        username: "",
        skillSlug: "test-skill",
        range: "^1.2.0",
        message: "Use 2.x",
      }),
  );
});

test("deprecate client maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(400, {
        error: {
          code: "invalid_request",
          message: "range invalid",
        },
      }),
    async () => {
      await assert.rejects(
        deprecateVersions("https://registry.example.com", "id-token", {
          username: "core",
          skillSlug: "test-skill",
          range: "^1.2.0",
          message: "Use 2.x",
        }),
        (error) => {
          assert.ok(error instanceof DeprecateApiError);
          assert.equal(error.status, 400);
          assert.equal(error.code, "invalid_request");
          return true;
        },
      );
    },
  );
});
