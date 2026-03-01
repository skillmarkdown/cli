const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { runLogoutCommand } = requireDist("commands/logout.js");
const runLogout = (clearSession) => runLogoutCommand([], { clearSession });

test("logout succeeds when session exists", () => {
  let cleared = false;
  const exitCode = runLogoutCommand([], {
    clearSession: () => {
      cleared = true;
      return true;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(cleared, true);
});

test("logout succeeds when no session exists", () => {
  assert.equal(
    runLogout(() => false),
    0,
  );
});

test("logout fails with usage on unsupported flags", () => {
  assert.equal(runLogoutCommand(["--bad-flag"]), 1);
});

test("logout returns failure when session clear throws", () => {
  const exitCode = runLogout(() => {
    throw new Error("unable to remove session");
  });

  assert.equal(exitCode, 1);
});
