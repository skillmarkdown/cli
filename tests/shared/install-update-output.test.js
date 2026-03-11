const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { countByStatus, printPruneTable, printSkillStatusTable, toUseApiErrorReason } = requireDist(
  "lib/shared/install-update-output.js",
);
const { UseApiError } = requireDist("lib/use/errors.js");

test("toUseApiErrorReason includes pro-plan hint for forbidden_plan", () => {
  const message = toUseApiErrorReason(
    new UseApiError(403, "forbidden", "private skill access is not allowed", {
      reason: "forbidden_plan",
    }),
  );

  assert.match(message, /private skill access is not allowed/i);
  assert.match(message, /private skills require a Pro plan/i);
});

test("printSkillStatusTable renders rows with spec and detail columns", async () => {
  const { logs } = await captureConsole(() =>
    printSkillStatusTable(
      [
        {
          skillId: "@username/skill-a",
          agentTarget: "claude",
          spec: "latest",
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
          status: "updated",
          reason: "resolved from dist-tag",
        },
      ],
      { includeSpec: true },
    ),
  );

  const output = logs.join("\n");
  assert.match(output, /SKILL/);
  assert.match(output, /SPEC/);
  assert.match(output, /@username\/skill-a/);
  assert.match(output, /resolved from dist-tag/);
});

test("printPruneTable prints empty-state message", async () => {
  const { logs } = await captureConsole(() => printPruneTable([]));

  assert.deepEqual(logs, ["Prune: no entries removed."]);
});

test("printPruneTable prints prune results table", async () => {
  const { logs } = await captureConsole(() =>
    printPruneTable([
      {
        skillId: "@username/skill-a",
        agentTarget: "openai",
        status: "pruned",
        reason: "not declared in skills.json",
      },
      {
        skillId: "@username/skill-b",
        agentTarget: "claude",
        status: "failed",
        reason: "install root is invalid",
      },
    ]),
  );

  const output = logs.join("\n");
  assert.match(output, /Prune results:/);
  assert.match(output, /@username\/skill-a/);
  assert.match(output, /pruned/);
  assert.match(output, /failed/);
});

test("countByStatus counts matching entries only", () => {
  const count = countByStatus(
    [{ status: "updated" }, { status: "updated" }, { status: "failed" }],
    "updated",
  );

  assert.equal(count, 2);
});
