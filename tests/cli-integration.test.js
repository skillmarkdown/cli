const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

function makeTempDirectory(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function runCli(args, cwd) {
  return childProcess.spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("spawned CLI: init scaffolds and validates by default", () => {
  const root = makeTempDirectory("skillmd-cli-integration-");
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
    cleanup(root);
  }
});

test("spawned CLI: validate succeeds on generated skill", () => {
  const root = makeTempDirectory("skillmd-cli-integration-");
  const skillDir = path.join(root, "integration-validate");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    const validateResult = runCli(["validate"], skillDir);
    assert.equal(validateResult.status, 0);
    assert.match(validateResult.stdout, /Validation passed: Spec validation passed\./);
  } finally {
    cleanup(root);
  }
});

test("spawned CLI: unknown command fails with usage", () => {
  const root = makeTempDirectory("skillmd-cli-integration-");

  try {
    const result = runCli(["unknown"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: skillmd <init\|validate>/);
  } finally {
    cleanup(root);
  }
});

test("spawned CLI: init rejects unsupported args", () => {
  const root = makeTempDirectory("skillmd-cli-integration-");
  const skillDir = path.join(root, "integration-args");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init", "--bad-flag"], skillDir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: skillmd init \[--no-validate\]/);
  } finally {
    cleanup(root);
  }
});
