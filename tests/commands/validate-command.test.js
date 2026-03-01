const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  withScaffoldedSkillDirectory,
  withSkillDirectory,
} = require("../helpers/skill-test-utils.js");

const { runValidateCommand } = requireDist("commands/validate.js");

const SKILL_PREFIX = "skillmd-validate-test-";

test("validates current directory by default", () => {
  withScaffoldedSkillDirectory(SKILL_PREFIX, "validate-default", "verbose", ({ dir }) => {
    assert.equal(runValidateCommand([], { cwd: dir }), 0);
  });
});

test("validates explicit path argument", () => {
  withScaffoldedSkillDirectory(SKILL_PREFIX, "validate-path", "verbose", ({ root, dir }) => {
    const runnerDir = path.join(root, "runner");
    fs.mkdirSync(runnerDir);
    assert.equal(runValidateCommand([dir], { cwd: runnerDir }), 0);
  });
});

for (const [name, args] of [
  ["fails when required spec file is missing", []],
  ["fails when too many path arguments are provided", ["a", "b"]],
  ["fails on unsupported flags", ["--bad-flag"]],
]) {
  test(name, () => {
    withSkillDirectory(SKILL_PREFIX, `validate-case-${name.length}`, ({ dir }) => {
      assert.equal(runValidateCommand(args, { cwd: dir }), 1);
    });
  });
}

test("strict mode fails when strict scaffold files are missing", () => {
  withSkillDirectory(SKILL_PREFIX, "validate-strict-missing", ({ dir }) => {
    const skillMd = `---
name: validate-strict-missing
description: Valid description for spec mode.
---

Body content.
`;
    fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd, "utf8");
    assert.equal(runValidateCommand(["--strict"], { cwd: dir }), 1);
  });
});

test("supports path plus --strict", () => {
  withScaffoldedSkillDirectory(SKILL_PREFIX, "validate-path-strict", "verbose", ({ root, dir }) => {
    const runnerDir = path.join(root, "runner");
    fs.mkdirSync(runnerDir);
    assert.equal(runValidateCommand([dir, "--strict"], { cwd: runnerDir }), 0);
  });
});

for (const [name, localDir, args, validateUpstream, validateLocal, expectedExit] of [
  [
    "passes parity when local and upstream both pass",
    "validate-parity-pass",
    ["--parity"],
    () => ({ status: "passed", message: "ok" }),
    undefined,
    0,
  ],
  [
    "fails parity when upstream is unavailable",
    "validate-parity-unavailable",
    ["--parity"],
    () => ({ status: "unavailable", message: "missing" }),
    undefined,
    1,
  ],
  [
    "fails parity on local/upstream status mismatch",
    "validate-parity-mismatch",
    ["--parity"],
    () => ({ status: "failed", message: "upstream rejected" }),
    undefined,
    1,
  ],
]) {
  test(name, () => {
    withScaffoldedSkillDirectory(SKILL_PREFIX, localDir, "verbose", ({ dir }) => {
      const options = { cwd: dir, validateUpstream };
      if (validateLocal) {
        options.validateLocal = validateLocal;
      }
      assert.equal(runValidateCommand(args, options), expectedExit);
    });
  });
}

test("supports parity with strict path mode", () => {
  withScaffoldedSkillDirectory(
    SKILL_PREFIX,
    "validate-parity-strict",
    "verbose",
    ({ root, dir }) => {
      const runnerDir = path.join(root, "runner");
      fs.mkdirSync(runnerDir);
      const exitCode = runValidateCommand([dir, "--strict", "--parity"], {
        cwd: runnerDir,
        validateUpstream: () => ({ status: "passed", message: "ok" }),
      });
      assert.equal(exitCode, 0);
    },
  );
});

for (const [name, localStatus, upstreamStatus] of [
  ["fails parity when local fails but upstream passes", "failed", "passed"],
  ["fails with matched parity when local and upstream both fail", "failed", "failed"],
]) {
  test(name, () => {
    withSkillDirectory(SKILL_PREFIX, `validate-parity-${name.length}`, ({ dir }) => {
      const exitCode = runValidateCommand(["--parity"], {
        cwd: dir,
        validateLocal: () => ({ status: localStatus, message: "local failed" }),
        validateUpstream: () => ({ status: upstreamStatus, message: "upstream status" }),
      });
      assert.equal(exitCode, 1);
    });
  });
}

test("returns failure when validator throws unexpectedly", () => {
  withSkillDirectory(SKILL_PREFIX, "validate-throws", ({ dir }) => {
    const exitCode = runValidateCommand([], {
      cwd: dir,
      validateLocal: () => {
        throw new Error("permission denied");
      },
    });
    assert.equal(exitCode, 1);
  });
});
