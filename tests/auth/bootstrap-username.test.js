const assert = require("node:assert/strict");
const test = require("node:test");

const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");
const { requireDist } = require("../helpers/dist-imports.js");
const { bootstrapUsername } = requireDist("lib/auth/bootstrap-username.js");

test("bootstrapUsername posts username payload and parses success", async () => {
  await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/auth/bootstrap-username");
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers.Authorization, "Bearer id-token");
      assert.deepEqual(JSON.parse(String(init?.body)), { username: "core" });
      return mockJsonResponse(200, {
        status: "bootstrapped",
        uid: "uid-1",
        owner: "@core",
        username: "core",
      });
    },
    async () => {
      const result = await bootstrapUsername("https://registry.example.com", "id-token", {
        username: "core",
      });
      assert.equal(result.username, "core");
    },
  );
});

test("bootstrapUsername surfaces renamed fallback error message", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(500, null),
    async () => {
      await assert.rejects(
        bootstrapUsername("https://registry.example.com", "id-token", { username: "core" }),
        /bootstrap-username request failed \(500\)/,
      );
    },
  );
});
