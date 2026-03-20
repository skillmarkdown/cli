const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { getUseEnvConfig } = requireDist("lib/use/config.js");

test("getUseEnvConfig resolves registry defaults and default agent target", () => {
  const config = getUseEnvConfig({
    SKILLMD_FIREBASE_API_KEY: "api-key",
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
  });

  assert.equal(config.firebaseProjectId, "skillmarkdown-development");
  assert.equal(config.registryBaseUrl, "https://registryapi-sm46rm3rja-uc.a.run.app");
  assert.equal(config.requestTimeoutMs, 10000);
  assert.equal(config.defaultAgentTarget, "skillmd");
});

test("getUseEnvConfig respects explicit agent target and registry overrides", () => {
  const config = getUseEnvConfig({
    SKILLMD_FIREBASE_API_KEY: "api-key",
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com/",
    SKILLMD_REGISTRY_TIMEOUT_MS: "5000",
    SKILLMD_AGENT_TARGET: "claude",
  });

  assert.equal(config.registryBaseUrl, "https://registry.example.com");
  assert.equal(config.requestTimeoutMs, 5000);
  assert.equal(config.defaultAgentTarget, "claude");
});

test("getUseEnvConfig throws for invalid agent target", () => {
  assert.throws(
    () =>
      getUseEnvConfig({
        SKILLMD_FIREBASE_API_KEY: "api-key",
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
        SKILLMD_AGENT_TARGET: "INVALID",
      }),
    /invalid SKILLMD_AGENT_TARGET/i,
  );
});
