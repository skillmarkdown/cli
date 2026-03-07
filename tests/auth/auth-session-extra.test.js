const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");

const { readAuthSession } = requireDist("lib/auth/session.js");

test("readAuthSession rejects blank projectId", () => {
  const dir = mkdtempSync(join(tmpdir(), "skillmd-auth-"));
  const sessionPath = join(dir, "auth.json");
  writeFileSync(
    sessionPath,
    JSON.stringify({
      provider: "email",
      uid: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
      projectId: "",
    }),
  );

  assert.equal(readAuthSession(sessionPath), null);
});
