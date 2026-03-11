const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { formatSessionProject, printSessionStatus } = requireDist("lib/auth/login-status.js");

function makeSession(overrides = {}) {
  return {
    provider: "email",
    uid: "uid-1",
    email: "user@example.com",
    refreshToken: "refresh-1",
    projectId: "skillmarkdown",
    ...overrides,
  };
}

test("formatSessionProject reports unknown without session project", () => {
  assert.deepEqual(formatSessionProject(makeSession({ projectId: "" })), {
    label: "unknown",
    mismatch: false,
  });
});

test("formatSessionProject includes current config when session project is missing", () => {
  assert.deepEqual(formatSessionProject(makeSession({ projectId: "" }), "skillmarkdown-dev"), {
    label: "unknown (current config: skillmarkdown-dev)",
    mismatch: false,
  });
});

test("printSessionStatus reports not logged in", async () => {
  const { result, logs } = await captureConsole(() => printSessionStatus(null, "skillmarkdown"));

  assert.equal(result, 1);
  assert.match(logs.join("\n"), /Not logged in/);
});

test("printSessionStatus uses uid when email is unavailable", async () => {
  const { result, logs } = await captureConsole(() =>
    printSessionStatus(makeSession({ email: "" }), "skillmarkdown"),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Logged in \(uid: uid-1, project: skillmarkdown\)/);
});

test("printSessionStatus prints reauth guidance on project mismatch", async () => {
  const { result, logs } = await captureConsole(() =>
    printSessionStatus(makeSession({ projectId: "skillmarkdown-prod" }), "skillmarkdown-dev"),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Current CLI config targets project 'skillmarkdown-dev'/);
  assert.match(logs.join("\n"), /skillmd login --reauth/);
});
