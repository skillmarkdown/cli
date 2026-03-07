const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { toUseApiErrorReason } = requireDist("lib/shared/install-update-output.js");
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
