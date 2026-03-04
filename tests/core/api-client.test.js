const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { authHeaders, extractApiErrorFields, parseApiResponse, parseJsonOrThrow, requestJson } =
  requireDist("lib/shared/api-client.js");

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

test("parseApiResponse returns validated payload for successful responses", async () => {
  const response = new Response(JSON.stringify({ ok: true }), { status: 200 });

  const parsed = await parseApiResponse(response, {
    label: "Test API",
    isValid: (value) => !!value && typeof value === "object" && value.ok === true,
    missingFieldsMessage: "missing fields",
    toApiError: () => new Error("not expected"),
  });

  assert.deepEqual(parsed, { ok: true });
});

test("parseApiResponse maps non-2xx payload to provided API error", async () => {
  class MockApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  const response = new Response(
    JSON.stringify({ error: { code: "invalid_request", message: "bad request" } }),
    { status: 400 },
  );

  await assert.rejects(
    parseApiResponse(response, {
      label: "Test API",
      isValid: () => true,
      missingFieldsMessage: "missing fields",
      toApiError: (status, payload) =>
        new MockApiError(status, payload.error?.code ?? "unknown_error", "mapped error"),
    }),
    (error) => {
      assert.equal(error instanceof MockApiError, true);
      assert.equal(error.status, 400);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
});

test("requestJson sends auth header and JSON body for write requests", async () => {
  await withMockedFetch(
    async (input, init) => {
      assert.equal(String(input), "https://example.com/v1/test");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer token_abc");
      assert.equal(init.headers["Content-Type"], "application/json");
      assert.equal(init.body, JSON.stringify({ name: "demo" }));
      return mockJsonResponse(200, { ok: true });
    },
    async () => {
      const result = await requestJson({
        url: "https://example.com/v1/test",
        method: "POST",
        idToken: "token_abc",
        body: { name: "demo" },
        label: "Test API",
        isValid: (value) => !!value && typeof value === "object" && value.ok === true,
        missingFieldsMessage: "missing fields",
        toApiError: () => new Error("not expected"),
      });
      assert.deepEqual(result, { ok: true });
    },
  );
});

test("requestJson omits auth and content-type when not needed", async () => {
  await withMockedFetch(
    async (_input, init) => {
      assert.equal(init.method, "GET");
      assert.equal(init.headers, undefined);
      assert.equal(init.body, undefined);
      return mockJsonResponse(200, { ok: true });
    },
    async () => {
      const result = await requestJson({
        url: "https://example.com/v1/test",
        method: "GET",
        label: "Test API",
        isValid: (value) => !!value && typeof value === "object" && value.ok === true,
        missingFieldsMessage: "missing fields",
        toApiError: () => new Error("not expected"),
      });
      assert.deepEqual(result, { ok: true });
    },
  );
});

test("requestJson maps non-2xx payload via toApiError", async () => {
  class MockApiError extends Error {
    constructor(status, code) {
      super("mapped");
      this.status = status;
      this.code = code;
    }
  }

  await withMockedFetch(
    async () => mockJsonResponse(429, { error: { code: "invalid_request", message: "limited" } }),
    async () => {
      await assert.rejects(
        requestJson({
          url: "https://example.com/v1/test",
          method: "GET",
          label: "Test API",
          isValid: () => true,
          missingFieldsMessage: "missing fields",
          toApiError: (status, payload) =>
            new MockApiError(status, payload.error?.code ?? "unknown_error"),
        }),
        (error) => {
          assert.equal(error instanceof MockApiError, true);
          assert.equal(error.status, 429);
          assert.equal(error.code, "invalid_request");
          return true;
        },
      );
    },
  );
});
