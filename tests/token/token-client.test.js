const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { TokenApiError } = requireDist("lib/token/errors.js");
const { createToken, listTokens, revokeToken } = requireDist("lib/token/client.js");

test("createToken sends payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/auth/tokens");
      assert.equal(init.method, "POST");
      assert.match(String(init.headers.Authorization), /^Bearer /);
      assert.deepEqual(JSON.parse(String(init.body)), {
        name: "ci",
        scope: "publish",
        expiresDays: 30,
      });
      return mockJsonResponse(200, {
        tokenId: "tok_abc123abc123abc123abc123",
        token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
        name: "ci",
        scope: "publish",
        createdAt: "2026-03-03T00:00:00.000Z",
        expiresAt: "2026-04-02T00:00:00.000Z",
      });
    },
    () =>
      createToken("https://registry.example.com", "id-token", {
        name: "ci",
        scope: "publish",
        expiresDays: 30,
      }),
  );

  assert.equal(payload.tokenId, "tok_abc123abc123abc123abc123");
  assert.equal(payload.scope, "publish");
});

test("listTokens parses list payload", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/auth/tokens");
      assert.equal(init.method, "GET");
      return mockJsonResponse(200, {
        tokens: [
          {
            tokenId: "tok_abc123abc123abc123abc123",
            name: "ci",
            scope: "publish",
            createdAt: "2026-03-03T00:00:00.000Z",
            expiresAt: "2026-04-02T00:00:00.000Z",
          },
        ],
      });
    },
    () => listTokens("https://registry.example.com", "id-token"),
  );

  assert.equal(payload.tokens.length, 1);
  assert.equal(payload.tokens[0].name, "ci");
});

test("revokeToken sends DELETE and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/auth/tokens/tok_abc123abc123abc123abc123");
      assert.equal(init.method, "DELETE");
      return mockJsonResponse(200, {
        status: "revoked",
        tokenId: "tok_abc123abc123abc123abc123",
      });
    },
    () => revokeToken("https://registry.example.com", "id-token", "tok_abc123abc123abc123abc123"),
  );

  assert.equal(payload.status, "revoked");
  assert.equal(payload.tokenId, "tok_abc123abc123abc123abc123");
});

test("token client maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(403, {
        error: {
          code: "forbidden",
          message: "insufficient token scope",
        },
      }),
    async () => {
      await assert.rejects(listTokens("https://registry.example.com", "id-token"), (error) => {
        assert.ok(error instanceof TokenApiError);
        assert.equal(error.status, 403);
        assert.equal(error.code, "forbidden");
        return true;
      });
    },
  );
});
