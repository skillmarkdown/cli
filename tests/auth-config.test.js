const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { makeTempDirectory, cleanupDirectory } = require("./helpers/fs-test-utils.js");
const { DEFAULT_LOGIN_AUTH_CONFIG } = require("../dist/lib/auth-defaults.js");
const { getDefaultUserEnvPath, getLoginEnvConfig } = require("../dist/lib/auth-config.js");

const AUTH_CONFIG_TEST_PREFIX = "skillmd-auth-config-";

test("uses built-in defaults when env and user config are absent", () => {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);

  try {
    const config = getLoginEnvConfig({}, { homeDir });
    assert.equal(config.githubClientId, DEFAULT_LOGIN_AUTH_CONFIG.githubClientId);
    assert.equal(config.firebaseApiKey, DEFAULT_LOGIN_AUTH_CONFIG.firebaseApiKey);
    assert.equal(config.firebaseProjectId, DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId);
  } finally {
    cleanupDirectory(homeDir);
  }
});

test("uses trusted user config from ~/.skillmd/.env when env vars are not set", () => {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);

  try {
    const userEnvPath = getDefaultUserEnvPath({ homeDir });
    fs.mkdirSync(path.dirname(userEnvPath), { recursive: true });
    fs.writeFileSync(
      userEnvPath,
      "SKILLMD_GITHUB_CLIENT_ID=from-user-file\n" +
        "SKILLMD_FIREBASE_API_KEY=from-user-file-key\n" +
        "SKILLMD_FIREBASE_PROJECT_ID=from-user-file-project\n",
      "utf8",
    );

    const config = getLoginEnvConfig({}, { homeDir });
    assert.equal(config.githubClientId, "from-user-file");
    assert.equal(config.firebaseApiKey, "from-user-file-key");
    assert.equal(config.firebaseProjectId, "from-user-file-project");
  } finally {
    cleanupDirectory(homeDir);
  }
});

test("env vars override trusted user config values", () => {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);

  try {
    const userEnvPath = getDefaultUserEnvPath({ homeDir });
    fs.mkdirSync(path.dirname(userEnvPath), { recursive: true });
    fs.writeFileSync(
      userEnvPath,
      "SKILLMD_GITHUB_CLIENT_ID=from-user-file\n" +
        "SKILLMD_FIREBASE_API_KEY=from-user-file-key\n" +
        "SKILLMD_FIREBASE_PROJECT_ID=from-user-file-project\n",
      "utf8",
    );

    const config = getLoginEnvConfig(
      {
        SKILLMD_GITHUB_CLIENT_ID: "from-env",
        SKILLMD_FIREBASE_API_KEY: "from-env-key",
        SKILLMD_FIREBASE_PROJECT_ID: "from-env-project",
      },
      { homeDir },
    );

    assert.equal(config.githubClientId, "from-env");
    assert.equal(config.firebaseApiKey, "from-env-key");
    assert.equal(config.firebaseProjectId, "from-env-project");
  } finally {
    cleanupDirectory(homeDir);
  }
});

test("ignores cwd .env to avoid untrusted directory overrides", () => {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);
  const cwd = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);
  const previousCwd = process.cwd();

  try {
    fs.writeFileSync(
      path.join(cwd, ".env"),
      "SKILLMD_GITHUB_CLIENT_ID=from-cwd\n" +
        "SKILLMD_FIREBASE_API_KEY=from-cwd-key\n" +
        "SKILLMD_FIREBASE_PROJECT_ID=from-cwd-project\n",
      "utf8",
    );
    process.chdir(cwd);

    const config = getLoginEnvConfig({}, { homeDir });
    assert.equal(config.githubClientId, DEFAULT_LOGIN_AUTH_CONFIG.githubClientId);
    assert.equal(config.firebaseApiKey, DEFAULT_LOGIN_AUTH_CONFIG.firebaseApiKey);
    assert.equal(config.firebaseProjectId, DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId);
  } finally {
    process.chdir(previousCwd);
    cleanupDirectory(homeDir);
    cleanupDirectory(cwd);
  }
});
