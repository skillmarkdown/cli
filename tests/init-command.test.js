const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runInitCommand } = require("../dist/commands/init.js");

function makeEmptySkillDirectory(skillName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skillmd-command-test-"));
  const dir = path.join(root, skillName);
  fs.mkdirSync(dir);
  return { root, dir };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("returns success when scaffold and validation succeed", () => {
  const { root, dir } = makeEmptySkillDirectory("command-pass");

  try {
    const exitCode = runInitCommand([], {
      cwd: dir,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(path.join(dir, "SKILL.md")), true);
  } finally {
    cleanup(root);
  }
});

test("returns failure when validation fails", () => {
  const { root, dir } = makeEmptySkillDirectory("command-validate-fail");

  try {
    const exitCode = runInitCommand([], {
      cwd: dir,
      validateSkill: () => ({ status: "failed", message: "bad skill" }),
    });

    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("returns success with --no-validate", () => {
  const { root, dir } = makeEmptySkillDirectory("command-no-validate");
  let validatorCalled = false;

  try {
    const exitCode = runInitCommand(["--no-validate"], {
      cwd: dir,
      validateSkill: () => {
        validatorCalled = true;
        return { status: "failed", message: "should not run" };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(validatorCalled, false);
  } finally {
    cleanup(root);
  }
});

test("returns failure when target directory is non-empty", () => {
  const { root, dir } = makeEmptySkillDirectory("command-non-empty");

  try {
    fs.writeFileSync(path.join(dir, "existing.txt"), "content", "utf8");
    const exitCode = runInitCommand([], { cwd: dir });

    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});

test("returns failure when init receives unsupported arguments", () => {
  const { root, dir } = makeEmptySkillDirectory("command-args");

  try {
    const exitCode = runInitCommand(["extra-arg"], {
      cwd: dir,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 1);
  } finally {
    cleanup(root);
  }
});
