const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { makeTempDirectory, cleanupDirectory } = require("./helpers/fs-test-utils.js");
const { getDefaultUserEnvPath, getLoginEnvConfig } = require("../dist/lib/auth-config.js");

const AUTH_CONFIG_TEST_PREFIX = "skillmd-auth-config-";

test("uses built-in defaults when env and user config are absent", () => {
  const homeDir = makeTempDirectory(AUTH_CONFIG_TEST_PREFIX);

  try {
    const config = getLoginEnvConfig({}, { homeDir });
    assert.equal(config.githubClientId, "Ov23linag5Xc0ufzhxsv");
    assert.equal(config.firebaseApiKey, "AIzaSyB1eLZYLzmkrEdXXT6aZKB7sIWkTvKzf6M");
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
      "SKILLMD_GITHUB_CLIENT_ID=from-user-file\nSKILLMD_FIREBASE_API_KEY=from-user-file-key\n",
      "utf8",
    );

    const config = getLoginEnvConfig({}, { homeDir });
    assert.equal(config.githubClientId, "from-user-file");
    assert.equal(config.firebaseApiKey, "from-user-file-key");
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
      "SKILLMD_GITHUB_CLIENT_ID=from-user-file\nSKILLMD_FIREBASE_API_KEY=from-user-file-key\n",
      "utf8",
    );

    const config = getLoginEnvConfig(
      {
        SKILLMD_GITHUB_CLIENT_ID: "from-env",
        SKILLMD_FIREBASE_API_KEY: "from-env-key",
      },
      { homeDir },
    );

    assert.equal(config.githubClientId, "from-env");
    assert.equal(config.firebaseApiKey, "from-env-key");
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
      "SKILLMD_GITHUB_CLIENT_ID=from-cwd\nSKILLMD_FIREBASE_API_KEY=from-cwd-key\n",
      "utf8",
    );
    process.chdir(cwd);

    const config = getLoginEnvConfig({}, { homeDir });
    assert.equal(config.githubClientId, "Ov23linag5Xc0ufzhxsv");
    assert.equal(config.firebaseApiKey, "AIzaSyB1eLZYLzmkrEdXXT6aZKB7sIWkTvKzf6M");
  } finally {
    process.chdir(previousCwd);
    cleanupDirectory(homeDir);
    cleanupDirectory(cwd);
  }
});
