const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const { makeTempDirectory, cleanupDirectory } = require("./helpers/fs-test-utils.js");

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
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

test("spawned CLI: init scaffolds and validates by default", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-skill");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init"], skillDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Initialized skill 'integration-skill'/);
    assert.match(result.stdout, /Validation passed: Spec and strict scaffold validation passed\./);

    const expectedFiles = [
      ".gitignore",
      "SKILL.md",
      "assets/.gitkeep",
      "references/.gitkeep",
      "scripts/.gitkeep",
    ];

    const files = [];
    for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const nested = fs.readdirSync(path.join(skillDir, entry.name), { withFileTypes: true });
        for (const nestedEntry of nested) {
          files.push(`${entry.name}/${nestedEntry.name}`);
        }
      } else {
        files.push(entry.name);
      }
    }

    assert.deepEqual(files.sort(), expectedFiles);
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
    assert.match(result.stderr, /Usage: skillmd <init\|validate\|login\|logout>/);
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
    assert.match(result.stderr, /Usage: skillmd init \[--no-validate\]/);
  } finally {
    cleanupDirectory(root);
  }
});
