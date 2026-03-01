const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { withSkillDirectory } = require("../helpers/skill-test-utils.js");

const { runInitCommand } = requireDist("commands/init.js");

const SKILL_PREFIX = "skillmd-command-test-";

test("returns success when scaffold and validation succeed", () => {
  withSkillDirectory(SKILL_PREFIX, "command-pass", ({ dir }) => {
    let strictValue = null;
    const exitCode = runInitCommand([], {
      cwd: dir,
      validateSkill: (_targetDir, options) => {
        strictValue = options?.strict ?? null;
        return { status: "passed", message: "ok" };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(strictValue, false);
    assert.equal(fs.existsSync(path.join(dir, "SKILL.md")), true);
  });
});

test("returns failure when validation fails", () => {
  withSkillDirectory(SKILL_PREFIX, "command-validate-fail", ({ dir }) => {
    const exitCode = runInitCommand([], {
      cwd: dir,
      validateSkill: () => ({ status: "failed", message: "bad skill" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns success with --no-validate", () => {
  withSkillDirectory(SKILL_PREFIX, "command-no-validate", ({ dir }) => {
    let validatorCalled = false;
    const exitCode = runInitCommand(["--no-validate"], {
      cwd: dir,
      validateSkill: () => {
        validatorCalled = true;
        return { status: "failed", message: "should not run" };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(validatorCalled, false);
  });
});

test("returns success with --template verbose and strict validation mode", () => {
  withSkillDirectory(SKILL_PREFIX, "command-template-verbose", ({ dir }) => {
    let strictValue = null;
    const exitCode = runInitCommand(["--template", "verbose"], {
      cwd: dir,
      validateSkill: (_targetDir, options) => {
        strictValue = options?.strict ?? null;
        return { status: "passed", message: "ok" };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(strictValue, true);
    assert.equal(fs.existsSync(path.join(dir, "SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(dir, "scripts", ".gitkeep")), true);
  });
});

test("supports equals form for --template", () => {
  withSkillDirectory(SKILL_PREFIX, "command-template-equals", ({ dir }) => {
    const exitCode = runInitCommand(["--template=verbose", "--no-validate"], {
      cwd: dir,
    });
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(path.join(dir, "scripts", ".gitkeep")), true);
  });
});

test("rejects --template example", () => {
  withSkillDirectory(SKILL_PREFIX, "command-template-example", ({ dir }) => {
    const exitCode = runInitCommand(["--template", "example", "--no-validate"], {
      cwd: dir,
    });
    assert.equal(exitCode, 1);
    assert.equal(fs.existsSync(path.join(dir, "scripts", ".gitkeep")), false);
  });
});

test("returns failure when target directory is non-empty", () => {
  withSkillDirectory(SKILL_PREFIX, "command-non-empty", ({ dir }) => {
    fs.writeFileSync(path.join(dir, "existing.txt"), "content", "utf8");
    const exitCode = runInitCommand([], { cwd: dir });
    assert.equal(exitCode, 1);
  });
});

test("returns failure when init receives unsupported arguments", () => {
  withSkillDirectory(SKILL_PREFIX, "command-args", ({ dir }) => {
    const exitCode = runInitCommand(["extra-arg"], {
      cwd: dir,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns failure when --template value is unknown", () => {
  withSkillDirectory(SKILL_PREFIX, "command-template-unknown", ({ dir }) => {
    const exitCode = runInitCommand(["--template", "claude"], {
      cwd: dir,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns failure with fallback message when non-Error is thrown", () => {
  withSkillDirectory(SKILL_PREFIX, "command-non-error-throw", ({ dir }) => {
    const originalError = console.error;
    let captured = "";
    console.error = (...args) => {
      captured += `${args.join(" ")}\n`;
    };

    try {
      const exitCode = runInitCommand([], {
        cwd: dir,
        validateSkill: () => {
          throw "nope";
        },
      });

      assert.equal(exitCode, 1);
      assert.match(captured, /Unknown error/);
    } finally {
      console.error = originalError;
    }
  });
});
