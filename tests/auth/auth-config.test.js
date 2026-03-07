const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");

const { getLoginEnvConfig, getDefaultUserEnvPath } = requireDist("lib/auth/config.js");

test("getDefaultUserEnvPath resolves inside .skillmd", () => {
  const homeDir = "/tmp/example-home";
  assert.equal(getDefaultUserEnvPath({ homeDir }), "/tmp/example-home/.skillmd/.env");
});

test("getLoginEnvConfig reads values from user env file", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-auth-"));
  mkdirSync(join(homeDir, ".skillmd"), { recursive: true });
  writeFileSync(
    join(homeDir, ".skillmd", ".env"),
    [
      "SKILLMD_GITHUB_CLIENT_ID=gh-client",
      "SKILLMD_FIREBASE_API_KEY=firebase-key",
      "SKILLMD_FIREBASE_PROJECT_ID=skillmarkdown-development",
    ].join("\n"),
  );

  const config = getLoginEnvConfig({}, { homeDir, executionPath: "/bin/skillmd" });
  assert.deepEqual(config, {
    githubClientId: "gh-client",
    firebaseApiKey: "firebase-key",
    firebaseProjectId: "skillmarkdown-development",
  });
});
