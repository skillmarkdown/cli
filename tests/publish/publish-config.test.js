const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { getPublishEnvConfig } = requireDist("lib/publish/config.js");

test("maps development project to default dev registry URL", () => {
  const config = getPublishEnvConfig({
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
  });
  assert.equal(config.firebaseProjectId, "skillmarkdown-development");
  assert.equal(config.registryBaseUrl, "https://registryapi-sm46rm3rja-uc.a.run.app");
  assert.equal(config.defaultAgentTarget, "skillmd");
});

test("maps production project to default prod registry URL", () => {
  const config = getPublishEnvConfig({
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown",
  });
  assert.equal(config.firebaseProjectId, "skillmarkdown");
  assert.equal(config.registryBaseUrl, "https://registry.skillmarkdown.com");
  assert.equal(config.defaultAgentTarget, "skillmd");
});

test("respects explicit registry base URL override", () => {
  const config = getPublishEnvConfig({
    SKILLMD_REGISTRY_BASE_URL: "https://example.com/custom/",
    SKILLMD_AGENT_TARGET: "claude",
  });
  assert.equal(config.registryBaseUrl, "https://example.com/custom");
  assert.equal(config.defaultAgentTarget, "claude");
});
