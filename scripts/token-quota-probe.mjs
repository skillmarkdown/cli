#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadInternalScriptEnv } from "./internal-env.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(ROOT_DIR, "dist", "cli.js");
const FUNCTIONS_DIR = resolve(ROOT_DIR, "..", "functions", "functions");
const DEV_PROJECT_ID = "skillmarkdown-development";
const DEV_REGISTRY_BASE_URL = "https://registryapi-sm46rm3rja-uc.a.run.app";

function resolveConfig(env) {
  const config = {
    firebaseProjectId: env.SKILLMD_FIREBASE_PROJECT_ID?.trim() || DEV_PROJECT_ID,
    registryBaseUrl: env.SKILLMD_REGISTRY_BASE_URL?.trim() || DEV_REGISTRY_BASE_URL,
    firebaseApiKey: env.SKILLMD_FIREBASE_API_KEY?.trim() || "",
    freeEmail: env.SKILLMD_QUOTA_FREE_EMAIL?.trim() || "quotafree@stefdevs.com",
    freePassword:
      env.SKILLMD_QUOTA_FREE_PASSWORD?.trim() || env.SKILLMD_LOGIN_PASSWORD?.trim() || "",
    freeUsername: env.SKILLMD_QUOTA_FREE_USERNAME?.trim() || "quotafree",
    proEmail: env.SKILLMD_QUOTA_PRO_EMAIL?.trim() || "quotapro@stefdevs.com",
    proPassword:
      env.SKILLMD_QUOTA_PRO_PASSWORD?.trim() ||
      env.SKILLMD_PRO_LOGIN_PASSWORD?.trim() ||
      env.SKILLMD_LOGIN_PASSWORD?.trim() ||
      "",
    proUsername: env.SKILLMD_QUOTA_PRO_USERNAME?.trim() || "quotapro",
  };

  const missing = [];
  if (!config.firebaseApiKey) missing.push("SKILLMD_FIREBASE_API_KEY");
  if (!config.freePassword) missing.push("SKILLMD_QUOTA_FREE_PASSWORD or SKILLMD_LOGIN_PASSWORD");
  if (!config.proPassword) {
    missing.push("SKILLMD_QUOTA_PRO_PASSWORD or SKILLMD_PRO_LOGIN_PASSWORD");
  }

  return { config, missing };
}

function ensureLocalPrerequisites() {
  if (!existsSync(CLI_PATH)) {
    throw new Error("missing dist/cli.js. Run 'npm run build' in the cli repo first.");
  }
  for (const helper of [
    "create-verified-auth-user.mjs",
    "set-user-plan.mjs",
    "reset-user-organizations.mjs",
    "reset-user-tokens.mjs",
    "reset-rate-limits.mjs",
  ]) {
    if (!existsSync(join(FUNCTIONS_DIR, "scripts", helper))) {
      throw new Error(`${helper} not found at ${FUNCTIONS_DIR}`);
    }
  }
}

function runNodeScript({ cwd, env, args, label }) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const combined = [result.stdout ?? "", result.stderr ?? ""].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed${combined ? `: ${combined}` : ""}`);
  }

  return result.stdout ?? "";
}

function runCli({ env, homeDir, args, label }) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    env: { ...process.env, ...env, HOME: homeDir },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  return {
    label,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function tryParseJson(value) {
  if (!value || !value.trim()) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureFixtureUser(env, fixture) {
  const isPro = fixture === "pro";
  const email = isPro ? env.proEmail : env.freeEmail;
  const password = isPro ? env.proPassword : env.freePassword;
  const username = isPro ? env.proUsername : env.freeUsername;
  const plan = isPro ? "pro" : "free";

  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: [
      "scripts/create-verified-auth-user.mjs",
      "--project",
      env.firebaseProjectId,
      "--email",
      email,
      "--password",
      password,
      "--username",
      username,
    ],
    label: `${fixture} token quota fixture user`,
  });

  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: [
      "scripts/set-user-plan.mjs",
      "--project",
      env.firebaseProjectId,
      "--email",
      email,
      "--plan",
      plan,
    ],
    label: `${fixture} token quota fixture plan`,
  });
}

function resetFixtureOrganizations(env, fixture) {
  const email = fixture === "pro" ? env.proEmail : env.freeEmail;
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: [
      "scripts/reset-user-organizations.mjs",
      "--project",
      env.firebaseProjectId,
      "--email",
      email,
    ],
    label: `${fixture} token quota fixture org reset`,
  });
}

function resetFixtureTokens(env, fixture) {
  const email = fixture === "pro" ? env.proEmail : env.freeEmail;
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: ["scripts/reset-user-tokens.mjs", "--project", env.firebaseProjectId, "--email", email],
    label: `${fixture} token quota fixture token reset`,
  });
}

function resetRateLimit(env, routeClass, key) {
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: [
      "scripts/reset-rate-limits.mjs",
      "--project",
      env.firebaseProjectId,
      "--route-class",
      routeClass,
      "--key",
      key,
    ],
    label: `reset ${routeClass}`,
  });
}

function loginFixture(env, fixture, homeDir) {
  const email = fixture === "pro" ? env.proEmail : env.freeEmail;
  const password = fixture === "pro" ? env.proPassword : env.freePassword;
  runNodeScript({
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      ...env,
      HOME: homeDir,
      SKILLMD_LOGIN_EMAIL: email,
      SKILLMD_LOGIN_PASSWORD: password,
    },
    args: [CLI_PATH, "login", "--reauth"],
    label: `${fixture} token quota fixture login`,
  });
}

function createOrganization(env, homeDir, slug, label) {
  const result = runCli({
    env,
    homeDir,
    args: ["org", "create", slug, "--json"],
    label,
  });
  assert(result.status === 0, `${label} failed: ${result.stderr || result.stdout}`);
  const payload = parseJson(result.stdout, label);
  assert(payload?.slug === slug, `${label} returned unexpected slug`);
}

function runUserTokenProbe(env, fixture) {
  const homeDir = mkdtempSync(join(tmpdir(), `skillmd-token-${fixture}-`));
  const email = fixture === "pro" ? env.proEmail : env.freeEmail;
  const username = fixture === "pro" ? env.proUsername : env.freeUsername;
  const fixtureUser = parseJson(
    runNodeScript({
      cwd: FUNCTIONS_DIR,
      env: {
        ...process.env,
        SKILLMD_FIREBASE_PROJECT_ID: env.firebaseProjectId,
        SKILLMD_REGISTRY_BASE_URL: env.registryBaseUrl,
        SKILLMD_FIREBASE_API_KEY: env.firebaseApiKey,
      },
      args: [
        "scripts/create-verified-auth-user.mjs",
        "--project",
        env.firebaseProjectId,
        "--registry-base-url",
        env.registryBaseUrl,
        "--api-key",
        env.firebaseApiKey,
        "--email",
        email,
        "--password",
        fixture === "pro" ? env.proPassword : env.freePassword,
        "--display-name",
        username,
        "--username",
        username,
        "--plan",
        fixture,
      ],
      label: `${fixture} token quota fixture user`,
    }),
    `${fixture} token quota fixture user`,
  );

  try {
    loginFixture(env, fixture, homeDir);

    for (let index = 1; index <= 20; index += 1) {
      resetRateLimit(
        env,
        "user_token_create_rate_limited",
        `user_token_create:uid:${fixtureUser.uid}`,
      );
      const result = runCli({
        env,
        homeDir,
        args: [
          "token",
          "add",
          `quota-token-${fixture}-${String(index).padStart(2, "0")}`,
          "--scope",
          "publish",
          "--days",
          "7",
          "--json",
        ],
        label: `${fixture} token create ${index}`,
      });
      assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
      const payload = parseJson(result.stdout, result.label);
      assert(payload?.tokenId, `${result.label} expected tokenId`);
    }

    const overflow = runCli({
      env,
      homeDir,
      args: [
        "token",
        "add",
        `quota-token-${fixture}-21`,
        "--scope",
        "publish",
        "--days",
        "7",
        "--json",
      ],
      label: `${fixture} token overflow`,
    });
    assert(overflow.status === 1, `${overflow.label} should fail`);
    const payload = tryParseJson(overflow.stdout);
    if (payload) {
      assert(
        payload?.error?.code === "plan_limit_exceeded",
        `${overflow.label} expected quota code`,
      );
      assert(
        payload?.error?.message === `${fixture} accounts can create up to 20 access tokens`,
        `${overflow.label} expected quota message`,
      );
      assert(
        payload?.error?.details?.currentCount === 20,
        `${overflow.label} expected currentCount=20`,
      );
      assert(
        payload?.error?.details?.maxAllowed === 20,
        `${overflow.label} expected maxAllowed=20`,
      );
      assert(
        payload?.error?.details?.plan === fixture,
        `${overflow.label} expected plan=${fixture}`,
      );
    } else {
      assert(
        overflow.stderr.includes(`${fixture} accounts can create up to 20 access tokens`),
        `${overflow.label} expected quota message in stderr`,
      );
    }

    return { fixture, userTokenLimit: 20 };
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

function runOrganizationTokenProbe(env) {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-org-token-pro-"));
  const orgSlug = "quota-token-pro";
  const fixtureUser = parseJson(
    runNodeScript({
      cwd: FUNCTIONS_DIR,
      env: {
        ...process.env,
        SKILLMD_FIREBASE_PROJECT_ID: env.firebaseProjectId,
        SKILLMD_REGISTRY_BASE_URL: env.registryBaseUrl,
        SKILLMD_FIREBASE_API_KEY: env.firebaseApiKey,
      },
      args: [
        "scripts/create-verified-auth-user.mjs",
        "--project",
        env.firebaseProjectId,
        "--registry-base-url",
        env.registryBaseUrl,
        "--api-key",
        env.firebaseApiKey,
        "--email",
        env.proEmail,
        "--password",
        env.proPassword,
        "--display-name",
        env.proUsername,
        "--username",
        env.proUsername,
        "--plan",
        "pro",
      ],
      label: "org token quota fixture user",
    }),
    "org token quota fixture user",
  );

  try {
    loginFixture(env, "pro", homeDir);
    createOrganization(env, homeDir, orgSlug, "pro org token probe org create");

    for (let index = 1; index <= 5; index += 1) {
      resetRateLimit(
        env,
        "org_token_create_rate_limited",
        `org_token_create:uid:${fixtureUser.uid}:${orgSlug}`,
      );
      const result = runCli({
        env,
        homeDir,
        args: [
          "org",
          "tokens",
          "add",
          orgSlug,
          `org-token-${String(index).padStart(2, "0")}`,
          "--scope",
          "admin",
          "--days",
          "7",
          "--json",
        ],
        label: `pro org token create ${index}`,
      });
      assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
      const payload = parseJson(result.stdout, result.label);
      assert(payload?.tokenId, `${result.label} expected tokenId`);
    }

    const overflow = runCli({
      env,
      homeDir,
      args: [
        "org",
        "tokens",
        "add",
        orgSlug,
        "org-token-06",
        "--scope",
        "admin",
        "--days",
        "7",
        "--json",
      ],
      label: "pro org token overflow",
    });
    assert(overflow.status === 1, `${overflow.label} should fail`);
    const payload = tryParseJson(overflow.stdout);
    if (payload) {
      assert(
        payload?.error?.code === "plan_limit_exceeded",
        `${overflow.label} expected quota code`,
      );
      assert(
        payload?.error?.message === "organizations can create up to 5 access tokens",
        `${overflow.label} expected quota message`,
      );
      assert(
        payload?.error?.details?.organizationSlug === orgSlug,
        `${overflow.label} expected organizationSlug`,
      );
      assert(
        payload?.error?.details?.currentCount === 5,
        `${overflow.label} expected currentCount=5`,
      );
      assert(payload?.error?.details?.maxAllowed === 5, `${overflow.label} expected maxAllowed=5`);
    } else {
      assert(
        overflow.stderr.includes("organizations can create up to 5 access tokens"),
        `${overflow.label} expected quota message in stderr`,
      );
    }

    return { fixture: "pro", orgSlug, organizationTokenLimit: 5 };
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

function main() {
  ensureLocalPrerequisites();
  const loadedEnv = loadInternalScriptEnv(process.env);
  const { config, missing } = resolveConfig(loadedEnv);
  if (missing.length > 0) {
    throw new Error(`missing required env: ${missing.join(", ")}`);
  }

  ensureFixtureUser(config, "free");
  ensureFixtureUser(config, "pro");
  resetFixtureOrganizations(config, "free");
  resetFixtureOrganizations(config, "pro");
  resetFixtureTokens(config, "free");
  resetFixtureTokens(config, "pro");

  const freeUserProbe = runUserTokenProbe(config, "free");
  resetFixtureTokens(config, "pro");
  const proUserProbe = runUserTokenProbe(config, "pro");
  resetFixtureOrganizations(config, "pro");
  const orgTokenProbe = runOrganizationTokenProbe(config);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        project: config.firebaseProjectId,
        registryBaseUrl: config.registryBaseUrl,
        freeUserProbe,
        proUserProbe,
        orgTokenProbe,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
