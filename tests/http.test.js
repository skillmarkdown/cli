const test = require("node:test");
const assert = require("node:assert/strict");

const { fetchWithTimeout } = require("../dist/lib/http.js");

function createAbortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

test("fetchWithTimeout returns response on success", async () => {
  const originalFetch = global.fetch;
  const expected = { ok: true, status: 200 };

  try {
    global.fetch = async (_input, init) => {
      assert.ok(init.signal);
      return expected;
    };

    const result = await fetchWithTimeout("https://example.com");
    assert.equal(result, expected);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithTimeout throws timeout error with cause", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            reject(createAbortError("aborted"));
          },
          { once: true },
        );
      });

    await assert.rejects(fetchWithTimeout("https://example.com", {}, { timeoutMs: 5 }), (error) => {
      assert.equal(error.message, "request timed out after 5ms");
      assert.equal(error.cause?.name, "AbortError");
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithTimeout preserves user-triggered abort errors", async () => {
  const originalFetch = global.fetch;
  const controller = new AbortController();

  try {
    global.fetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            reject(createAbortError("aborted by user"));
          },
          { once: true },
        );
      });

    const pending = fetchWithTimeout(
      "https://example.com",
      { signal: controller.signal },
      { timeoutMs: 1000 },
    );
    controller.abort("stop");

    await assert.rejects(pending, (error) => {
      assert.equal(error.name, "AbortError");
      assert.equal(error.message, "aborted by user");
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});
