const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), "scripts", "ensure-dev-fixtures-lib.mjs"),
  ).href;
  return import(moduleUrl);
}

test("resolveEnsureDevFixturesConfig reads required values and reports missing keys", async () => {
  const { resolveEnsureDevFixturesConfig } = await loadModule();

  const { config, missing } = resolveEnsureDevFixturesConfig({
    SKILLMD_FIREBASE_API_KEY: "dev-api-key",
    SKILLMD_LOGIN_EMAIL: "test@stefdevs.com",
    SKILLMD_LOGIN_PASSWORD: "Zerger!1",
    SKILLMD_PRO_LOGIN_EMAIL: "pro@stefdevs.com",
    SKILLMD_PRO_LOGIN_PASSWORD: "Zerger!1",
    SKILLMD_E2E_ORG_SLUG: "huggingface",
  });

  assert.deepEqual(missing, []);
  assert.equal(config.firebaseProjectId, "skillmarkdown-development");
  assert.equal(config.registryBaseUrl, "https://registryapi-sm46rm3rja-uc.a.run.app");
  assert.equal(config.freeUsername, "test");
  assert.equal(config.proUsername, "prostefdevs");
});

test("resolveEnsureDevFixturesConfig reports missing shared env values", async () => {
  const { resolveEnsureDevFixturesConfig } = await loadModule();

  const { missing } = resolveEnsureDevFixturesConfig({});

  assert.deepEqual(missing, [
    "SKILLMD_FIREBASE_API_KEY",
    "SKILLMD_LOGIN_EMAIL",
    "SKILLMD_LOGIN_PASSWORD",
    "SKILLMD_PRO_LOGIN_EMAIL",
    "SKILLMD_PRO_LOGIN_PASSWORD",
    "SKILLMD_E2E_ORG_SLUG",
  ]);
});

test("build fixture helper args use stable usernames and plans", async () => {
  const { buildCreateVerifiedAuthUserArgs, buildSetUserPlanArgs } = await loadModule();
  const config = {
    firebaseProjectId: "skillmarkdown-development",
    registryBaseUrl: "https://registryapi-sm46rm3rja-uc.a.run.app",
    firebaseApiKey: "dev-api-key",
    loginEmail: "test@stefdevs.com",
    loginPassword: "Zerger!1",
    proLoginEmail: "pro@stefdevs.com",
    proLoginPassword: "Zerger!1",
    freeUsername: "test",
    proUsername: "prostefdevs",
    freeDisplayName: "test",
    proDisplayName: "prostefdevs",
  };

  assert.deepEqual(buildCreateVerifiedAuthUserArgs(config, "free"), [
    "scripts/create-verified-auth-user.mjs",
    "--project",
    "skillmarkdown-development",
    "--registry-base-url",
    "https://registryapi-sm46rm3rja-uc.a.run.app",
    "--api-key",
    "dev-api-key",
    "--email",
    "test@stefdevs.com",
    "--password",
    "Zerger!1",
    "--display-name",
    "test",
    "--username",
    "test",
    "--plan",
    "free",
  ]);

  assert.deepEqual(buildSetUserPlanArgs(config, "pro"), [
    "scripts/set-user-plan.mjs",
    "--project",
    "skillmarkdown-development",
    "--email",
    "pro@stefdevs.com",
    "--plan",
    "pro",
  ]);
});

test("parseOrganizationsPayload returns organization slugs from cli json", async () => {
  const { parseOrganizationsPayload } = await loadModule();
  const stdout = JSON.stringify({
    organizations: [{ slug: "codexorg" }, { slug: "huggingface" }, { slug: 42 }, {}],
  });

  assert.deepEqual(parseOrganizationsPayload(stdout), ["codexorg", "huggingface"]);
});
