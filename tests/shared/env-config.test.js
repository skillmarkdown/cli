const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { getAuthRegistryEnvConfig, getLoginScopedRegistryEnvConfig } = requireDist(
  "lib/shared/env-config.js",
);

test("getAuthRegistryEnvConfig resolves login and registry defaults together", () => {
  const config = getAuthRegistryEnvConfig({
    SKILLMD_FIREBASE_API_KEY: "api-key",
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
  });

  assert.deepEqual(config, {
    firebaseApiKey: "api-key",
    firebaseProjectId: "skillmarkdown-development",
    registryBaseUrl: "https://registryapi-sm46rm3rja-uc.a.run.app",
    requestTimeoutMs: 10000,
  });
});

test("getAuthRegistryEnvConfig respects registry overrides", () => {
  const config = getAuthRegistryEnvConfig({
    SKILLMD_FIREBASE_API_KEY: "api-key",
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    SKILLMD_REGISTRY_BASE_URL: "https://example.com/registry/",
    SKILLMD_REGISTRY_TIMEOUT_MS: "2500",
  });

  assert.equal(config.registryBaseUrl, "https://example.com/registry");
  assert.equal(config.requestTimeoutMs, 2500);
});

test("getLoginScopedRegistryEnvConfig omits auth-only fields", () => {
  const config = getLoginScopedRegistryEnvConfig({
    SKILLMD_FIREBASE_API_KEY: "api-key",
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
  });

  assert.deepEqual(config, {
    registryBaseUrl: "https://registryapi-sm46rm3rja-uc.a.run.app",
    requestTimeoutMs: 10000,
  });
});

test("getAuthRegistryEnvConfig falls back to default development login configuration", () => {
  const config = getAuthRegistryEnvConfig({
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
  });

  assert.equal(config.firebaseProjectId, "skillmarkdown-development");
  assert.match(config.firebaseApiKey, /^[A-Za-z0-9_-]+$/);
});
