const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveUpdateIntent } = requireDist("lib/update/intent.js");

test("resolveUpdateIntent prefers installIntent metadata when present", () => {
  const resolved = resolveUpdateIntent({
    installIntent: {
      strategy: "channel",
      value: "beta",
    },
    sourceCommand: "skillmd use @owner/skill --version 1.2.3",
  });

  assert.deepEqual(resolved, {
    selector: {
      strategy: "channel",
      value: "beta",
    },
    installIntent: {
      strategy: "channel",
      value: "beta",
    },
  });
});

test("resolveUpdateIntent infers version selector from legacy sourceCommand", () => {
  const resolved = resolveUpdateIntent({
    sourceCommand: "skillmd use @owner/skill --version 1.2.3",
  });

  assert.deepEqual(resolved, {
    selector: {
      strategy: "version",
      value: "1.2.3",
    },
    installIntent: {
      strategy: "version",
      value: "1.2.3",
    },
  });
});

test("resolveUpdateIntent infers channel selector from legacy sourceCommand", () => {
  const resolved = resolveUpdateIntent({
    sourceCommand: "skillmd use @owner/skill --channel beta",
  });

  assert.deepEqual(resolved, {
    selector: {
      strategy: "channel",
      value: "beta",
    },
    installIntent: {
      strategy: "channel",
      value: "beta",
    },
  });
});

test("resolveUpdateIntent defaults to latest_fallback_beta when metadata is missing", () => {
  const resolved = resolveUpdateIntent(null);

  assert.deepEqual(resolved, {
    selector: {
      strategy: "latest_fallback_beta",
      value: null,
    },
    installIntent: {
      strategy: "latest_fallback_beta",
      value: null,
    },
  });
});
