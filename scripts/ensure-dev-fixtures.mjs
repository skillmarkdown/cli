#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadInternalScriptEnv } from "./internal-env.mjs";
import {
  buildCreateVerifiedAuthUserArgs,
  buildSetUserPlanArgs,
  parseOrganizationsPayload,
  resolveEnsureDevFixturesConfig,
} from "./ensure-dev-fixtures-lib.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(ROOT_DIR, "dist", "cli.js");
const FUNCTIONS_DIR = resolve(ROOT_DIR, "..", "functions", "functions");
const PRIVATE_SEARCH_SEED_SCRIPT = join(ROOT_DIR, "scripts", "publish-private-search-seed.mjs");

function ensureLocalPrerequisites() {
  if (!existsSync(CLI_PATH)) {
    throw new Error("missing dist/cli.js. Run 'npm run build' in the cli repo first.");
  }
  if (!existsSync(join(FUNCTIONS_DIR, "scripts", "create-verified-auth-user.mjs"))) {
    throw new Error(`functions admin helpers not found at ${FUNCTIONS_DIR}`);
  }
  if (!existsSync(PRIVATE_SEARCH_SEED_SCRIPT)) {
    throw new Error(`private search seed script not found at ${PRIVATE_SEARCH_SEED_SCRIPT}`);
  }
}

function runNodeScript({ cwd, args, env, label }) {
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

function runCliJson({ env, homeDir, args, label }) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    env: { ...env, HOME: homeDir },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const combined = [result.stdout ?? "", result.stderr ?? ""].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed${combined ? `: ${combined}` : ""}`);
  }

  try {
    return JSON.parse(result.stdout ?? "");
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function ensureOrganization(env, config) {
  const isolatedHome = mkdtempSync(join(tmpdir(), "skillmd-fixtures-org-"));
  try {
    runNodeScript({
      cwd: ROOT_DIR,
      env: {
        ...env,
        HOME: isolatedHome,
        SKILLMD_LOGIN_EMAIL: config.loginEmail,
        SKILLMD_LOGIN_PASSWORD: config.loginPassword,
      },
      args: [CLI_PATH, "login", "--reauth"],
      label: "free fixture login",
    });

    const orgs = runCliJson({
      env,
      homeDir: isolatedHome,
      args: ["org", "ls", "--json"],
      label: "org ls",
    });
    const slugs = parseOrganizationsPayload(JSON.stringify(orgs));
    if (!slugs.includes(config.orgSlug)) {
      runCliJson({
        env,
        homeDir: isolatedHome,
        args: ["org", "create", config.orgSlug, "--json"],
        label: "org create",
      });
    }
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true });
  }
}

function verifyProFixture(env, config) {
  const isolatedHome = mkdtempSync(join(tmpdir(), "skillmd-fixtures-pro-"));
  try {
    runNodeScript({
      cwd: ROOT_DIR,
      env: {
        ...env,
        HOME: isolatedHome,
        SKILLMD_LOGIN_EMAIL: config.proLoginEmail,
        SKILLMD_LOGIN_PASSWORD: config.proLoginPassword,
      },
      args: [CLI_PATH, "login", "--reauth"],
      label: "pro fixture login",
    });

    const payload = runCliJson({
      env,
      homeDir: isolatedHome,
      args: ["whoami", "--json"],
      label: "pro whoami",
    });

    if (payload?.plan !== "pro") {
      throw new Error(
        `pro fixture plan mismatch: expected pro, received ${payload?.plan ?? "null"}`,
      );
    }
    if (payload?.entitlements?.canUsePrivateSkills !== true) {
      throw new Error("pro fixture missing canUsePrivateSkills entitlement");
    }
    if (payload?.entitlements?.canPublishPrivateSkills !== true) {
      throw new Error("pro fixture missing canPublishPrivateSkills entitlement");
    }
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true });
  }
}

function ensurePrivateSearchSeed(env, config) {
  const query = env.SKILLMD_E2E_PRIVATE_CURSOR_QUERY?.trim() || "cursorseed";
  const prefix = `${query}-${config.proUsername}`;
  runNodeScript({
    cwd: ROOT_DIR,
    env: {
      ...env,
      SKILLMD_LOGIN_EMAIL: config.proLoginEmail,
      SKILLMD_LOGIN_PASSWORD: config.proLoginPassword,
    },
    args: [PRIVATE_SEARCH_SEED_SCRIPT, "--count", "6", "--prefix", prefix],
    label: "private search seed",
  });
  return { query, prefix, count: 6 };
}

function main() {
  ensureLocalPrerequisites();

  const env = loadInternalScriptEnv();
  const { config, missing } = resolveEnsureDevFixturesConfig(env);
  if (missing.length > 0) {
    throw new Error(`missing required internal env values: ${missing.join(", ")}`);
  }

  console.log("Ensuring free auth fixture...");
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: buildCreateVerifiedAuthUserArgs(config, "free"),
    label: "free auth fixture",
  });
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: buildSetUserPlanArgs(config, "free"),
    label: "free plan sync",
  });

  console.log("Ensuring pro auth fixture...");
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: buildCreateVerifiedAuthUserArgs(config, "pro"),
    label: "pro auth fixture",
  });
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: buildSetUserPlanArgs(config, "pro"),
    label: "pro plan sync",
  });

  console.log("Ensuring dev org fixture...");
  ensureOrganization(env, config);

  console.log("Verifying pro entitlements...");
  verifyProFixture(env, config);

  console.log("Ensuring private search seed corpus...");
  const privateSearchSeed = ensurePrivateSearchSeed(env, config);

  console.log(
    JSON.stringify(
      {
        projectId: config.firebaseProjectId,
        registryBaseUrl: config.registryBaseUrl,
        freeFixture: {
          email: config.loginEmail,
          username: config.freeUsername,
          plan: "free",
        },
        proFixture: {
          email: config.proLoginEmail,
          username: config.proUsername,
          plan: "pro",
        },
        privateSearchSeed,
        orgSlug: config.orgSlug,
        status: "ready",
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
}
