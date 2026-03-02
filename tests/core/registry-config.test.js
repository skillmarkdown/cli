const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { getRegistryEnvConfig } = requireDist("lib/registry/config.js");

test("getRegistryEnvConfig resolves defaults from project config", () => {
  const config = getRegistryEnvConfig({
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
  });

  assert.equal(config.firebaseProjectId, "skillmarkdown-development");
  assert.equal(config.registryBaseUrl, "https://registryapi-sm46rm3rja-uc.a.run.app");
  assert.equal(config.requestTimeoutMs, 10000);
});

test("getRegistryEnvConfig respects explicit base URL and timeout overrides", () => {
  const config = getRegistryEnvConfig({
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    SKILLMD_REGISTRY_BASE_URL: "https://example.com/registry/",
    SKILLMD_REGISTRY_TIMEOUT_MS: "3000",
  });

  assert.equal(config.registryBaseUrl, "https://example.com/registry");
  assert.equal(config.requestTimeoutMs, 3000);
});

test("getRegistryEnvConfig accepts explicit firebase project id option", () => {
  const config = getRegistryEnvConfig(
    {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    },
    { firebaseProjectId: "skillmarkdown" },
  );

  assert.equal(config.firebaseProjectId, "skillmarkdown");
  assert.equal(config.registryBaseUrl, "https://registry.skillmarkdown.com");
});
