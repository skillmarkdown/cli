const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");

const { readAuthSession } = requireDist("lib/auth/session.js");

test("readAuthSession rejects blank projectId", () => {
  const dir = mkdtempSync(join(tmpdir(), "skillmd-session-"));
  const path = join(dir, "auth.json");
  writeFileSync(
    path,
    JSON.stringify({
      provider: "github",
      uid: "uid_1",
      refreshToken: "refresh",
      projectId: "",
    }),
  );

  assert.equal(readAuthSession(path), null);
});
