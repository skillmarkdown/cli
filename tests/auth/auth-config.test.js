const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");

const { getDefaultUserEnvPath, getLoginEnvConfig } = requireDist("lib/auth/config.js");

test("getDefaultUserEnvPath resolves inside .skillmd", () => {
  const path = getDefaultUserEnvPath({ homeDir: "/tmp/home" });
  assert.equal(path, "/tmp/home/.skillmd/.env");
});

test("getLoginEnvConfig reads values from user env file", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-env-"));
  const envPath = join(homeDir, ".skillmd", ".env");
  mkdirSync(join(homeDir, ".skillmd"), { recursive: true });
  writeFileSync(
    envPath,
    ["SKILLMD_FIREBASE_API_KEY=firebase-key", "SKILLMD_FIREBASE_PROJECT_ID=skillmarkdown"].join(
      "\n",
    ),
  );

  const result = getLoginEnvConfig({}, { homeDir });
  assert.deepEqual(result, {
    firebaseApiKey: "firebase-key",
    firebaseProjectId: "skillmarkdown",
  });
});
