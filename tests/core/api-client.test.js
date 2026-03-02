const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { authHeaders, extractApiErrorFields, parseJsonOrThrow } = requireDist(
  "lib/shared/api-client.js",
);

test("parseJsonOrThrow parses JSON payloads", async () => {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const parsed = await parseJsonOrThrow(response, "Test API");
  assert.deepEqual(parsed, { ok: true });
});

test("parseJsonOrThrow reports non-JSON payloads with label and status", async () => {
  const response = new Response("not-json", { status: 502 });

  await assert.rejects(parseJsonOrThrow(response, "History API"), /History API.*\(502\)/i);
});

test("extractApiErrorFields prefers nested envelope and falls back correctly", () => {
  const nested = extractApiErrorFields(
    400,
    {
      error: {
        code: "invalid_request",
        message: "bad request",
        details: { field: "q" },
      },
      code: "ignored",
      message: "ignored",
      details: { ignored: true },
    },
    "fallback",
  );
  assert.deepEqual(nested, {
    code: "invalid_request",
    message: "bad request",
    details: { field: "q" },
  });

  const fallback = extractApiErrorFields(500, {}, "default message");
  assert.deepEqual(fallback, {
    code: "unknown_error",
    message: "default message",
    details: undefined,
  });
});

test("authHeaders only returns authorization header when token is provided", () => {
  assert.equal(authHeaders(), undefined);
  assert.deepEqual(authHeaders("token_123"), {
    Authorization: "Bearer token_123",
  });
});
