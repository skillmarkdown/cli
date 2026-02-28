const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { runValidateCommand } = require("../dist/commands/validate.js");
const { scaffoldSkillInDirectory } = require("../dist/lib/scaffold.js");
const { createSkillDirectoryFactory, cleanupDirectory } = require("./helpers/fs-test-utils.js");

const makeEmptySkillDirectory = createSkillDirectoryFactory("skillmd-validate-test-");

function withSkillDirectory(skillName, run) {
  const { root, dir } = makeEmptySkillDirectory(skillName);
  try {
    run({ root, dir });
  } finally {
    cleanupDirectory(root);
  }
}

function withScaffoldedSkillDirectory(skillName, run) {
  withSkillDirectory(skillName, ({ root, dir }) => {
    scaffoldSkillInDirectory(dir);
    run({ root, dir });
  });
}

test("validates current directory by default", () => {
  withScaffoldedSkillDirectory("validate-default", ({ dir }) => {
    const exitCode = runValidateCommand([], { cwd: dir });
    assert.equal(exitCode, 0);
  });
});

test("validates explicit path argument", () => {
  withScaffoldedSkillDirectory("validate-path", ({ root, dir }) => {
    const runnerDir = path.join(root, "runner");
    fs.mkdirSync(runnerDir);
    const exitCode = runValidateCommand([dir], { cwd: runnerDir });
    assert.equal(exitCode, 0);
  });
});

test("fails when required spec file is missing", () => {
  withSkillDirectory("validate-missing-spec", ({ dir }) => {
    const exitCode = runValidateCommand([], { cwd: dir });
    assert.equal(exitCode, 1);
  });
});

test("fails when too many path arguments are provided", () => {
  withSkillDirectory("validate-args", ({ dir }) => {
    const exitCode = runValidateCommand(["a", "b"], { cwd: dir });
    assert.equal(exitCode, 1);
  });
});

test("fails on unsupported flags", () => {
  withSkillDirectory("validate-unsupported-flag", ({ dir }) => {
    const exitCode = runValidateCommand(["--bad-flag"], { cwd: dir });
    assert.equal(exitCode, 1);
  });
});

test("strict mode fails when strict scaffold files are missing", () => {
  withSkillDirectory("validate-strict-missing", ({ dir }) => {
    const skillMd = `---
name: validate-strict-missing
description: Valid description for spec mode.
---

Body content.
`;
    fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd, "utf8");
    const exitCode = runValidateCommand(["--strict"], { cwd: dir });
    assert.equal(exitCode, 1);
  });
});

test("supports path plus --strict", () => {
  withScaffoldedSkillDirectory("validate-path-strict", ({ root, dir }) => {
    const runnerDir = path.join(root, "runner");
    fs.mkdirSync(runnerDir);
    const exitCode = runValidateCommand([dir, "--strict"], { cwd: runnerDir });
    assert.equal(exitCode, 0);
  });
});

test("passes parity when local and upstream both pass", () => {
  withScaffoldedSkillDirectory("validate-parity-pass", ({ dir }) => {
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateUpstream: () => ({ status: "passed", message: "ok" }),
    });
    assert.equal(exitCode, 0);
  });
});

test("fails parity when upstream is unavailable", () => {
  withScaffoldedSkillDirectory("validate-parity-unavailable", ({ dir }) => {
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateUpstream: () => ({ status: "unavailable", message: "missing" }),
    });
    assert.equal(exitCode, 1);
  });
});

test("fails parity on local/upstream status mismatch", () => {
  withScaffoldedSkillDirectory("validate-parity-mismatch", ({ dir }) => {
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateUpstream: () => ({ status: "failed", message: "upstream rejected" }),
    });
    assert.equal(exitCode, 1);
  });
});

test("supports parity with strict path mode", () => {
  withScaffoldedSkillDirectory("validate-parity-strict", ({ root, dir }) => {
    const runnerDir = path.join(root, "runner");
    fs.mkdirSync(runnerDir);
    const exitCode = runValidateCommand([dir, "--strict", "--parity"], {
      cwd: runnerDir,
      validateUpstream: () => ({ status: "passed", message: "ok" }),
    });
    assert.equal(exitCode, 0);
  });
});

test("fails parity when local fails but upstream passes", () => {
  withSkillDirectory("validate-parity-local-fail-upstream-pass", ({ dir }) => {
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateLocal: () => ({ status: "failed", message: "local failed" }),
      validateUpstream: () => ({ status: "passed", message: "upstream passed" }),
    });
    assert.equal(exitCode, 1);
  });
});

test("fails with matched parity when local and upstream both fail", () => {
  withSkillDirectory("validate-parity-both-fail", ({ dir }) => {
    const exitCode = runValidateCommand(["--parity"], {
      cwd: dir,
      validateLocal: () => ({ status: "failed", message: "local failed" }),
      validateUpstream: () => ({ status: "failed", message: "upstream failed" }),
    });
    assert.equal(exitCode, 1);
  });
});
