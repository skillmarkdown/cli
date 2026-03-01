const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");
const {
  MINIMAL_SCAFFOLD_FILES,
  VERBOSE_SCAFFOLD_FILES,
} = require("../helpers/scaffold-expected.js");

const CLI_PATH = path.resolve(process.cwd(), "dist/cli.js");
const CLI_TEST_PREFIX = "skillmd-cli-integration-";

function runCli(args, cwd) {
  return childProcess.spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: cwd,
    },
  });
}

function writeSession(homeDir, session) {
  const sessionDir = path.join(homeDir, ".skillmd");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, "auth.json"), JSON.stringify(session, null, 2), "utf8");
}

function listScaffoldFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const nested = fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true });
      for (const nestedEntry of nested) {
        files.push(`${entry.name}/${nestedEntry.name}`);
      }
      continue;
    }

    files.push(entry.name);
  }

  return files.sort();
}

test("spawned CLI: init scaffolds and validates by default", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-skill");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init"], skillDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Initialized skill 'integration-skill'/);
    assert.match(result.stdout, /Validation passed: Spec validation passed\./);
    assert.deepEqual(listScaffoldFiles(skillDir), MINIMAL_SCAFFOLD_FILES);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: init with --template verbose scaffolds strict template", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-verbose");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init", "--template", "verbose"], skillDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Validation passed: Spec and strict scaffold validation passed\./);
    assert.deepEqual(listScaffoldFiles(skillDir), VERBOSE_SCAFFOLD_FILES);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: validate succeeds on generated skill", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-validate");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    const validateResult = runCli(["validate"], skillDir);
    assert.equal(validateResult.status, 0);
    assert.match(validateResult.stdout, /Validation passed: Spec validation passed\./);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: unknown command fails with usage", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["unknown"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: skillmd <init\|validate\|login\|logout\|publish>/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: logout succeeds when no session exists", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["logout"], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No active session to log out\./);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: logout fails gracefully on malformed session path", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    fs.mkdirSync(path.join(root, ".skillmd", "auth.json"), { recursive: true });
    const result = runCli(["logout"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /skillmd logout:/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: login status reports not logged in by default", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["login", "--status"], root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Not logged in\./);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: init rejects unsupported args", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-args");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init", "--bad-flag"], skillDir);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Usage: skillmd init \[--no-validate\] \[--template <minimal\|verbose>\]/,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: publish --dry-run succeeds for verbose scaffold", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-publish-verbose");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--template", "verbose", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    writeSession(skillDir, {
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      email: "user@example.com",
      refreshToken: "refresh-token",
    });

    const publishResult = runCli(
      ["publish", "--version", "1.0.0", "--dry-run", "--json"],
      skillDir,
    );
    assert.equal(publishResult.status, 0);
    const parsed = JSON.parse(publishResult.stdout);
    assert.equal(parsed.status, "dry-run");
    assert.equal(parsed.skillId, "@core/integration-publish-verbose");
    assert.equal(parsed.version, "1.0.0");
    assert.equal(parsed.channel, "latest");
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: publish fails fast on invalid strict scaffold", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-publish-minimal");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    writeSession(skillDir, {
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      refreshToken: "refresh-token",
    });

    const publishResult = runCli(["publish", "--version", "1.0.0", "--dry-run"], skillDir);
    assert.equal(publishResult.status, 1);
    assert.match(publishResult.stderr, /Validation failed/);
  } finally {
    cleanupDirectory(root);
  }
});
