#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
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
  if (!existsSync(join(FUNCTIONS_DIR, "scripts", "create-verified-auth-user.mjs"))) {
    throw new Error(`functions admin helpers not found at ${FUNCTIONS_DIR}`);
  }
  if (!existsSync(join(FUNCTIONS_DIR, "scripts", "set-user-plan.mjs"))) {
    throw new Error(`set-user-plan helper not found at ${FUNCTIONS_DIR}`);
  }
  if (!existsSync(join(FUNCTIONS_DIR, "scripts", "reset-user-organizations.mjs"))) {
    throw new Error(`reset-user-organizations helper not found at ${FUNCTIONS_DIR}`);
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
    env: { ...env, HOME: homeDir },
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
      password,
      "--display-name",
      username,
      "--username",
      username,
      "--plan",
      plan,
    ],
    label: `${fixture} quota fixture user`,
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
    label: `${fixture} quota fixture plan`,
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
    label: `${fixture} quota fixture org reset`,
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
    label: `${fixture} quota fixture login`,
  });
}

function runQuotaProbeForFixture(env, fixture, limit) {
  const username = fixture === "pro" ? env.proUsername : env.freeUsername;
  const prefix = fixture === "pro" ? "quota-pro" : "quota-free";
  const homeDir = mkdtempSync(join(tmpdir(), `skillmd-quota-${fixture}-`));

  try {
    loginFixture(env, fixture, homeDir);

    for (let index = 1; index <= limit; index += 1) {
      const slug = `${prefix}-${String(index).padStart(2, "0")}`;
      const result = runCli({
        env,
        homeDir,
        args: ["org", "create", slug, "--json"],
        label: `${fixture} create ${slug}`,
      });
      assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
      const payload = parseJson(result.stdout, result.label);
      assert(payload?.slug === slug, `${result.label} returned unexpected slug`);
      assert(payload?.owner === `@${slug}`, `${result.label} returned unexpected owner`);
    }

    const extraSlug = `${prefix}-${String(limit + 1).padStart(2, "0")}`;
    const overflow = runCli({
      env,
      homeDir,
      args: ["org", "create", extraSlug, "--json"],
      label: `${fixture} overflow create`,
    });
    assert(overflow.status === 1, `${overflow.label} should fail`);
    const payload = parseJson(overflow.stdout, overflow.label);
    assert(payload?.ok === false, `${overflow.label} should return a json error envelope`);
    assert(
      payload?.error?.code === "plan_limit_exceeded",
      `${overflow.label} expected plan_limit_exceeded`,
    );
    assert(
      payload?.error?.message === `${fixture} accounts can create up to ${limit} organizations`,
      `${overflow.label} expected quota message`,
    );
    assert(
      payload?.error?.details?.currentCount === limit,
      `${overflow.label} expected currentCount=${limit}`,
    );
    assert(
      payload?.error?.details?.maxAllowed === limit,
      `${overflow.label} expected maxAllowed=${limit}`,
    );
    assert(payload?.error?.details?.plan === fixture, `${overflow.label} expected plan=${fixture}`);

    const whoami = runCli({
      env,
      homeDir,
      args: ["whoami", "--json"],
      label: `${fixture} whoami`,
    });
    assert(whoami.status === 0, `${whoami.label} failed`);
    const whoamiPayload = parseJson(whoami.stdout, whoami.label);
    const organizations = Array.isArray(whoamiPayload?.organizations)
      ? whoamiPayload.organizations
      : [];
    assert(
      organizations.length === limit,
      `${whoami.label} expected ${limit} organizations, received ${organizations.length}`,
    );

    return {
      fixture,
      username,
      limit,
      createdPrefix: prefix,
      overflowSlug: extraSlug,
      organizations: organizations.map((entry) => entry.slug),
    };
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

async function main() {
  ensureLocalPrerequisites();

  const { config, missing } = resolveConfig(loadInternalScriptEnv());
  if (missing.length > 0) {
    throw new Error(`missing required env values: ${missing.join(", ")}`);
  }

  ensureFixtureUser(config, "free");
  ensureFixtureUser(config, "pro");
  resetFixtureOrganizations(config, "free");
  resetFixtureOrganizations(config, "pro");

  const freeResult = runQuotaProbeForFixture(config, "free", 5);
  const proResult = runQuotaProbeForFixture(config, "pro", 20);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        project: config.firebaseProjectId,
        registryBaseUrl: config.registryBaseUrl,
        checks: [freeResult, proResult],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
