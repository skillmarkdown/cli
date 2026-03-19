const DEV_PROJECT_ID = "skillmarkdown-development";
const DEV_REGISTRY_BASE_URL = "https://registryapi-sm46rm3rja-uc.a.run.app";

export const DEV_FIXTURE_DEFAULTS = {
  freeUsername: "test",
  proUsername: "prostefdevs",
  freeDisplayName: "test",
  proDisplayName: "prostefdevs",
};

export function resolveEnsureDevFixturesConfig(env) {
  const config = {
    firebaseProjectId: env.SKILLMD_FIREBASE_PROJECT_ID?.trim() || DEV_PROJECT_ID,
    registryBaseUrl: env.SKILLMD_REGISTRY_BASE_URL?.trim() || DEV_REGISTRY_BASE_URL,
    firebaseApiKey: env.SKILLMD_FIREBASE_API_KEY?.trim() || "",
    loginEmail: env.SKILLMD_LOGIN_EMAIL?.trim() || "",
    loginPassword: env.SKILLMD_LOGIN_PASSWORD?.trim() || "",
    proLoginEmail: env.SKILLMD_PRO_LOGIN_EMAIL?.trim() || "",
    proLoginPassword: env.SKILLMD_PRO_LOGIN_PASSWORD?.trim() || "",
    orgSlug: env.SKILLMD_E2E_ORG_SLUG?.trim() || "",
    freeUsername: DEV_FIXTURE_DEFAULTS.freeUsername,
    proUsername: DEV_FIXTURE_DEFAULTS.proUsername,
    freeDisplayName: DEV_FIXTURE_DEFAULTS.freeDisplayName,
    proDisplayName: DEV_FIXTURE_DEFAULTS.proDisplayName,
  };

  const missing = [];
  if (!config.firebaseApiKey) {
    missing.push("SKILLMD_FIREBASE_API_KEY");
  }
  if (!config.loginEmail) {
    missing.push("SKILLMD_LOGIN_EMAIL");
  }
  if (!config.loginPassword) {
    missing.push("SKILLMD_LOGIN_PASSWORD");
  }
  if (!config.proLoginEmail) {
    missing.push("SKILLMD_PRO_LOGIN_EMAIL");
  }
  if (!config.proLoginPassword) {
    missing.push("SKILLMD_PRO_LOGIN_PASSWORD");
  }
  if (!config.orgSlug) {
    missing.push("SKILLMD_E2E_ORG_SLUG");
  }

  return { config, missing };
}

export function buildCreateVerifiedAuthUserArgs(config, fixture) {
  const isPro = fixture === "pro";
  return [
    "scripts/create-verified-auth-user.mjs",
    "--project",
    config.firebaseProjectId,
    "--registry-base-url",
    config.registryBaseUrl,
    "--api-key",
    config.firebaseApiKey,
    "--email",
    isPro ? config.proLoginEmail : config.loginEmail,
    "--password",
    isPro ? config.proLoginPassword : config.loginPassword,
    "--display-name",
    isPro ? config.proDisplayName : config.freeDisplayName,
    "--username",
    isPro ? config.proUsername : config.freeUsername,
    "--plan",
    isPro ? "pro" : "free",
  ];
}

export function buildSetUserPlanArgs(config, fixture) {
  return [
    "scripts/set-user-plan.mjs",
    "--project",
    config.firebaseProjectId,
    "--email",
    fixture === "pro" ? config.proLoginEmail : config.loginEmail,
    "--plan",
    fixture === "pro" ? "pro" : "free",
  ];
}

export function parseOrganizationsPayload(stdout) {
  const payload = JSON.parse(stdout);
  const organizations = Array.isArray(payload?.organizations) ? payload.organizations : [];
  return organizations
    .map((entry) => (typeof entry?.slug === "string" ? entry.slug : ""))
    .filter((slug) => slug.length > 0);
}
