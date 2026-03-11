const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseLoginFlags } = requireDist("lib/auth/login-flags.js");

test("parseLoginFlags accepts empty args", () => {
  assert.deepEqual(parseLoginFlags([]), {
    status: false,
    reauth: false,
    valid: true,
  });
});

test("parseLoginFlags accepts --status", () => {
  assert.deepEqual(parseLoginFlags(["--status"]), {
    status: true,
    reauth: false,
    valid: true,
  });
});

test("parseLoginFlags accepts --reauth", () => {
  assert.deepEqual(parseLoginFlags(["--reauth"]), {
    status: false,
    reauth: true,
    valid: true,
  });
});

test("parseLoginFlags rejects unsupported flags", () => {
  assert.deepEqual(parseLoginFlags(["--bad"]), {
    status: false,
    reauth: false,
    valid: false,
  });
});

test("parseLoginFlags rejects combining --status and --reauth", () => {
  assert.deepEqual(parseLoginFlags(["--status", "--reauth"]), {
    status: false,
    reauth: false,
    valid: false,
  });
});
