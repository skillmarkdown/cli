const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { withSkillDirectory } = require("../helpers/skill-test-utils.js");

const { runCreateCommand } = requireDist("commands/create.js");

const SKILL_PREFIX = "skillmd-create-command-test-";

test("creates target directory and returns success when scaffold and validation succeed", () => {
  withSkillDirectory(SKILL_PREFIX, "command-pass", ({ root }) => {
    let strictValue = null;
    const exitCode = runCreateCommand(["created-skill"], {
      cwd: root,
      validateSkill: (_targetDir, options) => {
        strictValue = options?.strict ?? null;
        return { status: "passed", message: "ok" };
      },
    });

    const targetDir = path.join(root, "created-skill");
    assert.equal(exitCode, 0);
    assert.equal(strictValue, false);
    assert.equal(fs.existsSync(path.join(targetDir, "SKILL.md")), true);
  });
});

test("returns failure when validation fails", () => {
  withSkillDirectory(SKILL_PREFIX, "command-validate-fail", ({ root }) => {
    const exitCode = runCreateCommand(["created-skill"], {
      cwd: root,
      validateSkill: () => ({ status: "failed", message: "bad skill" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns success with --no-validate", () => {
  withSkillDirectory(SKILL_PREFIX, "command-no-validate", ({ root }) => {
    let validatorCalled = false;
    const exitCode = runCreateCommand(["created-skill", "--no-validate"], {
      cwd: root,
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
  withSkillDirectory(SKILL_PREFIX, "command-template-verbose", ({ root }) => {
    let strictValue = null;
    const exitCode = runCreateCommand(["created-skill", "--template", "verbose"], {
      cwd: root,
      validateSkill: (_targetDir, options) => {
        strictValue = options?.strict ?? null;
        return { status: "passed", message: "ok" };
      },
    });

    const targetDir = path.join(root, "created-skill");
    assert.equal(exitCode, 0);
    assert.equal(strictValue, true);
    assert.equal(fs.existsSync(path.join(targetDir, "SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "scripts", ".gitkeep")), true);
  });
});

test("supports equals form for --template", () => {
  withSkillDirectory(SKILL_PREFIX, "command-template-equals", ({ root }) => {
    const exitCode = runCreateCommand(["created-skill", "--template=verbose", "--no-validate"], {
      cwd: root,
    });
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(path.join(root, "created-skill", "scripts", ".gitkeep")), true);
  });
});

test("returns failure when target already exists", () => {
  withSkillDirectory(SKILL_PREFIX, "command-existing-target", ({ root }) => {
    const originalError = console.error;
    let captured = "";
    console.error = (...args) => {
      captured += `${args.join(" ")}\n`;
    };
    fs.mkdirSync(path.join(root, "created-skill"));
    try {
      const exitCode = runCreateCommand(["created-skill"], { cwd: root });
      assert.equal(exitCode, 1);
      assert.match(captured, /target path already exists: created-skill/);
      assert.doesNotMatch(captured, /EEXIST/);
    } finally {
      console.error = originalError;
    }
  });
});

test("returns failure when create receives unsupported arguments", () => {
  withSkillDirectory(SKILL_PREFIX, "command-args", ({ root }) => {
    const exitCode = runCreateCommand(["created-skill", "extra-arg"], {
      cwd: root,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns failure when target is missing", () => {
  withSkillDirectory(SKILL_PREFIX, "command-missing-target", ({ root }) => {
    const exitCode = runCreateCommand([], {
      cwd: root,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns failure when --template value is unknown", () => {
  withSkillDirectory(SKILL_PREFIX, "command-template-unknown", ({ root }) => {
    const exitCode = runCreateCommand(["created-skill", "--template", "claude"], {
      cwd: root,
      validateSkill: () => ({ status: "passed", message: "ok" }),
    });

    assert.equal(exitCode, 1);
  });
});

test("returns failure with fallback message when non-Error is thrown", () => {
  withSkillDirectory(SKILL_PREFIX, "command-non-error-throw", ({ root }) => {
    const originalError = console.error;
    let captured = "";
    console.error = (...args) => {
      captured += `${args.join(" ")}\n`;
    };

    try {
      const exitCode = runCreateCommand(["created-skill"], {
        cwd: root,
        validateSkill: () => {
          throw "nope";
        },
      });

      assert.equal(exitCode, 1);
      assert.match(captured, /skillmd create: Unknown error/);
    } finally {
      console.error = originalError;
    }
  });
});
