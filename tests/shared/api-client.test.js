const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { extractApiErrorFields, authHeaders, requestJson } = requireDist("lib/shared/api-client.js");
const { CliApiError } = requireDist("lib/shared/api-errors.js");

function apiErrorFactory(status, payload) {
  const parsed = extractApiErrorFields(status, payload, `failed (${status})`);
  return new CliApiError("TestApiError", status, parsed.code, parsed.message, parsed.details);
}

test("extractApiErrorFields lifts nested fields and requestId into details", () => {
  const fields = extractApiErrorFields(
    403,
    {
      requestId: "req_123",
      error: {
        code: "forbidden",
        message: "denied",
        details: { reason: "forbidden_plan" },
      },
    },
    "fallback",
  );

  assert.equal(fields.code, "forbidden");
  assert.equal(fields.message, "denied");
  assert.deepEqual(fields.details, { reason: "forbidden_plan", requestId: "req_123" });
});

test("authHeaders omits authorization when no token is provided", () => {
  assert.equal(authHeaders(), undefined);
  assert.deepEqual(authHeaders("id-token"), { Authorization: "Bearer id-token" });
});

test("requestJson performs GET and returns validated payload", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    assert.match(String(input), /\/v1\/example$/);
    assert.equal(init.method, "GET");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const result = await requestJson({
      url: "https://registry.example.com/v1/example",
      method: "GET",
      label: "Example API",
      isValid: (value) => Boolean(value && value.ok === true),
      missingFieldsMessage: "missing fields",
      toApiError: apiErrorFactory,
    });

    assert.deepEqual(result, { ok: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestJson sends JSON body and auth header for POST", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input, init) => {
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer id-token");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.body, JSON.stringify({ hello: "world" }));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const result = await requestJson({
      url: "https://registry.example.com/v1/example",
      method: "POST",
      idToken: "id-token",
      body: { hello: "world" },
      label: "Example API",
      isValid: (value) => Boolean(value && value.ok === true),
      missingFieldsMessage: "missing fields",
      toApiError: apiErrorFactory,
    });

    assert.deepEqual(result, { ok: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestJson surfaces API errors with requestId details", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        requestId: "req_456",
        error: { code: "forbidden", message: "denied", details: { reason: "forbidden_plan" } },
      }),
      { status: 403 },
    );

  try {
    await assert.rejects(
      requestJson({
        url: "https://registry.example.com/v1/example",
        method: "GET",
        label: "Example API",
        isValid: () => true,
        missingFieldsMessage: "missing fields",
        toApiError: apiErrorFactory,
      }),
      (error) => {
        assert.equal(error.code, "forbidden");
        assert.equal(error.message, "denied");
        assert.deepEqual(error.details, { reason: "forbidden_plan", requestId: "req_456" });
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestJson rejects invalid success payloads", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ nope: true }), { status: 200 });

  try {
    await assert.rejects(
      requestJson({
        url: "https://registry.example.com/v1/example",
        method: "GET",
        label: "Example API",
        isValid: () => false,
        missingFieldsMessage: "missing fields",
        toApiError: apiErrorFactory,
      }),
      /missing fields/i,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestJson reports non-JSON responses", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("oops", { status: 500 });

  try {
    await assert.rejects(
      requestJson({
        url: "https://registry.example.com/v1/example",
        method: "GET",
        label: "Example API",
        isValid: () => true,
        missingFieldsMessage: "missing fields",
        toApiError: apiErrorFactory,
      }),
      /non-JSON response/i,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
