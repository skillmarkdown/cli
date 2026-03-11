function makeRegistryEnv(overrides = {}) {
  return {
    SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
    SKILLMD_FIREBASE_API_KEY: "api-key",
    SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
    SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
    ...overrides,
  };
}

function makeRegistryConfig(overrides = {}) {
  return {
    firebaseApiKey: "api-key",
    firebaseProjectId: "skillmarkdown-development",
    registryBaseUrl: "https://registry.example.com",
    requestTimeoutMs: 10000,
    ...overrides,
  };
}

function makeEmailSession(overrides = {}) {
  return {
    provider: "email",
    uid: "uid-1",
    refreshToken: "refresh-token",
    projectId: "skillmarkdown-development",
    ...overrides,
  };
}

function makeWhoamiOwner(overrides = {}) {
  return {
    uid: "uid-1",
    owner: "@core",
    username: "core",
    email: "core@example.com",
    projectId: "skillmarkdown-development",
    authType: "firebase",
    scope: "admin",
    plan: "pro",
    entitlements: { privateSkills: true },
    ...overrides,
  };
}

module.exports = {
  makeEmailSession,
  makeRegistryConfig,
  makeRegistryEnv,
  makeWhoamiOwner,
};
