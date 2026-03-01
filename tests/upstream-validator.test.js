const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const childProcess = require("node:child_process");

const upstreamValidator = require("../dist/lib/upstream-validator.js");

const ORIGINAL_SPAWN_SYNC = childProcess.spawnSync;

function withSpawnSyncMock(mock, fn) {
  childProcess.spawnSync = mock;
  try {
    fn();
  } finally {
    childProcess.spawnSync = ORIGINAL_SPAWN_SYNC;
  }
}

test("returns unavailable when skills-ref is missing (ENOENT)", () => {
  withSpawnSyncMock(
    () => ({ error: { code: "ENOENT" } }),
    () => {
      const result = upstreamValidator.validateWithSkillsRef(path.resolve("."));
      assert.equal(result.status, "unavailable");
      assert.match(result.message, /not installed/);
    },
  );
});

test("returns unavailable on generic execution errors", () => {
  withSpawnSyncMock(
    () => ({ error: new Error("boom") }),
    () => {
      const result = upstreamValidator.validateWithSkillsRef(path.resolve("."));
      assert.equal(result.status, "unavailable");
      assert.match(result.message, /execution failed/);
    },
  );
});

test("returns unavailable when skills-ref times out", () => {
  const timeoutError = new Error("spawnSync skills-ref ETIMEDOUT");
  timeoutError.code = "ETIMEDOUT";

  withSpawnSyncMock(
    () => ({ error: timeoutError }),
    () => {
      const result = upstreamValidator.validateWithSkillsRef(path.resolve("."));
      assert.equal(result.status, "unavailable");
      assert.match(result.message, /timed out after 10000ms/);
    },
  );
});

test("returns passed with fallback message when no output", () => {
  withSpawnSyncMock(
    () => ({ status: 0, stdout: "", stderr: "" }),
    () => {
      const result = upstreamValidator.validateWithSkillsRef(path.resolve("."));
      assert.equal(result.status, "passed");
      assert.equal(result.message, "skills-ref validation passed");
    },
  );
});

test("returns failed with fallback message when no output", () => {
  withSpawnSyncMock(
    () => ({ status: 2, stdout: "", stderr: "" }),
    () => {
      const result = upstreamValidator.validateWithSkillsRef(path.resolve("."));
      assert.equal(result.status, "failed");
      assert.equal(result.message, "skills-ref validation failed");
    },
  );
});

test("joins stdout and stderr in message output", () => {
  withSpawnSyncMock(
    () => ({ status: 2, stdout: "line-a\n", stderr: "line-b\n" }),
    () => {
      const result = upstreamValidator.validateWithSkillsRef(path.resolve("."));
      assert.equal(result.status, "failed");
      assert.equal(result.message, "line-a\nline-b");
    },
  );
});
