const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { fetchWithTimeout } = requireDist("lib/http.js");

function createAbortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

test("fetchWithTimeout returns response on success", async () => {
  const expected = { ok: true, status: 200 };

  const result = await withMockedFetch(
    async (_input, init) => {
      assert.ok(init.signal);
      return expected;
    },
    () => fetchWithTimeout("https://example.com"),
  );

  assert.equal(result, expected);
});

test("fetchWithTimeout throws timeout error with cause", async () => {
  await withMockedFetch(
    async (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            reject(createAbortError("aborted"));
          },
          { once: true },
        );
      }),
    async () => {
      await assert.rejects(
        fetchWithTimeout("https://example.com", {}, { timeoutMs: 5 }),
        (error) => {
          assert.equal(error.message, "request timed out after 5ms");
          assert.equal(error.cause?.name, "AbortError");
          return true;
        },
      );
    },
  );
});

test("fetchWithTimeout preserves user-triggered abort errors", async () => {
  const controller = new AbortController();

  await withMockedFetch(
    async (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            reject(createAbortError("aborted by user"));
          },
          { once: true },
        );
      }),
    async () => {
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
    },
  );
});
