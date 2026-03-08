const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveUsernameEmail, UsernameLookupApiError } = requireDist("lib/auth/username-lookup.js");

test("resolveUsernameEmail returns email for a username", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ username: "test", email: "test@example.com" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const email = await resolveUsernameEmail("https://registry.example.com", "test");
    assert.equal(email, "test@example.com");
  } finally {
    global.fetch = originalFetch;
  }
});

test("resolveUsernameEmail surfaces API errors", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ error: { code: "not_found", message: "username not found" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      () => resolveUsernameEmail("https://registry.example.com", "missing"),
      (error) => {
        assert.ok(error instanceof UsernameLookupApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        assert.match(error.message, /username not found/);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
