const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { cleanupDirectory, makeTempDirectory } = require("../helpers/fs-test-utils.js");

const { DEFAULT_LOGIN_AUTH_CONFIG } = requireDist("lib/auth-defaults.js");
const { getDefaultUserEnvPath, getLoginEnvConfig } = requireDist("lib/auth-config.js");

const AUTH_CONFIG_TEST_PREFIX = "skillmd-auth-config-";
const USER_FILE_CONFIG = {
  githubClientId: "from-user-file",
  firebaseApiKey: "from-user-file-key",
  firebaseProjectId: "from-user-file-project",
};

function withHomeDir(run) {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);
  try {
    run(homeDir);
  } finally {
    cleanupDirectory(homeDir);
  }
}

function writeUserConfig(homeDir, values) {
  const userEnvPath = getDefaultUserEnvPath({ homeDir });
  fs.mkdirSync(path.dirname(userEnvPath), { recursive: true });
  fs.writeFileSync(
    userEnvPath,
    [
      `SKILLMD_GITHUB_CLIENT_ID=${values.githubClientId}`,
      `SKILLMD_FIREBASE_API_KEY=${values.firebaseApiKey}`,
      `SKILLMD_FIREBASE_PROJECT_ID=${values.firebaseProjectId}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

function assertConfigValues(config, expected) {
  assert.equal(config.githubClientId, expected.githubClientId);
  assert.equal(config.firebaseApiKey, expected.firebaseApiKey);
  assert.equal(config.firebaseProjectId, expected.firebaseProjectId);
}

test("uses built-in defaults when env and user config are absent", () => {
  withHomeDir((homeDir) => {
    assertConfigValues(getLoginEnvConfig({}, { homeDir }), DEFAULT_LOGIN_AUTH_CONFIG);
  });
});

for (const [name, env, expected] of [
  ["uses trusted user config from ~/.skillmd/.env when env vars are not set", {}, USER_FILE_CONFIG],
  [
    "env vars override trusted user config values",
    {
      SKILLMD_GITHUB_CLIENT_ID: "from-env",
      SKILLMD_FIREBASE_API_KEY: "from-env-key",
      SKILLMD_FIREBASE_PROJECT_ID: "from-env-project",
    },
    {
      githubClientId: "from-env",
      firebaseApiKey: "from-env-key",
      firebaseProjectId: "from-env-project",
    },
  ],
]) {
  test(name, () => {
    withHomeDir((homeDir) => {
      writeUserConfig(homeDir, USER_FILE_CONFIG);
      assertConfigValues(getLoginEnvConfig(env, { homeDir }), expected);
    });
  });
}

test("ignores cwd .env to avoid untrusted directory overrides", () => {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);
  const cwd = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);
  const previousCwd = process.cwd();

  try {
    fs.writeFileSync(
      path.join(cwd, ".env"),
      [
        "SKILLMD_GITHUB_CLIENT_ID=from-cwd",
        "SKILLMD_FIREBASE_API_KEY=from-cwd-key",
        "SKILLMD_FIREBASE_PROJECT_ID=from-cwd-project",
        "",
      ].join("\n"),
      "utf8",
    );

    process.chdir(cwd);
    assertConfigValues(getLoginEnvConfig({}, { homeDir }), DEFAULT_LOGIN_AUTH_CONFIG);
  } finally {
    process.chdir(previousCwd);
    cleanupDirectory(homeDir);
    cleanupDirectory(cwd);
  }
});
