const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { createCachedReadTokenResolver } = requireDist("lib/shared/read-token-cache.js");

test("createCachedReadTokenResolver caches successful token resolutions", async () => {
  let calls = 0;
  const resolve = createCachedReadTokenResolver(async () => {
    calls += 1;
    return "token-123";
  });

  assert.equal(await resolve(), "token-123");
  assert.equal(await resolve(), "token-123");
  assert.equal(calls, 1);
});

test("createCachedReadTokenResolver shares in-flight requests", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const resolve = createCachedReadTokenResolver(async () => {
    calls += 1;
    await gate;
    return "shared-token";
  });

  const first = resolve();
  const second = resolve();
  release();

  assert.equal(await first, "shared-token");
  assert.equal(await second, "shared-token");
  assert.equal(calls, 1);
});

test("createCachedReadTokenResolver does not cache null results", async () => {
  let calls = 0;
  const resolve = createCachedReadTokenResolver(async () => {
    calls += 1;
    return null;
  });

  assert.equal(await resolve(), null);
  assert.equal(await resolve(), null);
  assert.equal(calls, 2);
});

test("createCachedReadTokenResolver clears in-flight state after rejection", async () => {
  let calls = 0;
  const resolve = createCachedReadTokenResolver(async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error("temporary failure");
    }
    return "recovered-token";
  });

  await assert.rejects(resolve(), /temporary failure/i);
  assert.equal(await resolve(), "recovered-token");
  assert.equal(calls, 2);
});
