const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runValidateCommand } = require("../dist/commands/validate.js");
const { scaffoldSkillInDirectory } = require("../dist/lib/scaffold.js");

function makeEmptySkillDirectory(skillName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skillmd-validate-test-"));
  const dir = path.join(root, skillName);
  fs.mkdirSync(dir);
  return { root, dir };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("validates current directory by default", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-default");

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand([], { cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    cleanup(root);
  }
});

test("validates explicit path argument", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-path");
  const runnerDir = path.join(root, "runner");
  fs.mkdirSync(runnerDir);

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand([dir], { cwd: runnerDir });
    assert.equal(exitCode, 0);
  } finally {
    cleanup(root);
  }
});

test("fails when required spec file is missing", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-missing-spec");

  try {
    const exitCode = runValidateCommand([], { cwd: dir });
    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("fails when too many path arguments are provided", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-args");

  try {
    const exitCode = runValidateCommand(["a", "b"], { cwd: dir });
    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("fails on unsupported flags", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-unsupported-flag");

  try {
    const exitCode = runValidateCommand(["--bad-flag"], { cwd: dir });
    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("strict mode fails when strict scaffold files are missing", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-strict-missing");
  const skillMd = `---
name: validate-strict-missing
description: Valid description for spec mode.
---

Body content.
`;

  try {
    fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd, "utf8");
    const exitCode = runValidateCommand(["--strict"], { cwd: dir });
    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("supports path plus --strict", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-path-strict");
  const runnerDir = path.join(root, "runner");
  fs.mkdirSync(runnerDir);

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand([dir, "--strict"], { cwd: runnerDir });
    assert.equal(exitCode, 0);
  } finally {
    cleanup(root);
  }
});

test("passes parity when local and upstream both pass", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-parity-pass");

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateUpstream: () => ({ status: "passed", message: "ok" }),
    });
    assert.equal(exitCode, 0);
  } finally {
    cleanup(root);
  }
});

test("fails parity when upstream is unavailable", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-parity-unavailable");

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateUpstream: () => ({ status: "unavailable", message: "missing" }),
    });
    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("fails parity on local/upstream status mismatch", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-parity-mismatch");

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateUpstream: () => ({ status: "failed", message: "upstream rejected" }),
    });
    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("supports parity with strict path mode", () => {
  const { root, dir } = makeEmptySkillDirectory("validate-parity-strict");
  const runnerDir = path.join(root, "runner");
  fs.mkdirSync(runnerDir);

  try {
    scaffoldSkillInDirectory(dir);
    const exitCode = runValidateCommand([dir, "--strict", "--parity"], {
      cwd: runnerDir,
      validateUpstream: () => ({ status: "passed", message: "ok" }),
    });
    assert.equal(exitCode, 0);
  } finally {
    cleanup(root);
  }
});
