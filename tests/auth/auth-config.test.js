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

test("getLoginEnvConfig defaults to development project and key inside a local checkout", () => {
  const cwd = "/tmp/workspace/cli";
  const executionPath = "/tmp/workspace/cli/dist/cli.js";

  const result = getLoginEnvConfig(
    {},
    {
      cwd,
      executionPath,
      homeDir: "/tmp/nonexistent-home",
    },
  );

  assert.deepEqual(result, {
    firebaseApiKey: "AIzaSyB1eLZYLzmkrEdXXT6aZKB7sIWkTvKzf6M",
    firebaseProjectId: "skillmarkdown-development",
  });
});

test("getLoginEnvConfig defaults to production project and key outside a local checkout", () => {
  const result = getLoginEnvConfig(
    {},
    {
      cwd: "/tmp/other-project",
      executionPath: "/tmp/workspace/cli/dist/cli.js",
      homeDir: "/tmp/nonexistent-home",
    },
  );

  assert.deepEqual(result, {
    firebaseApiKey: "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok",
    firebaseProjectId: "skillmarkdown",
  });
});
