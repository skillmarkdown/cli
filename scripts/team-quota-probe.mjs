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
  for (const helper of [
    "create-verified-auth-user.mjs",
    "set-user-plan.mjs",
    "reset-user-organizations.mjs",
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
    label: `${fixture} team quota fixture user`,
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
    label: `${fixture} team quota fixture plan`,
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
    label: `${fixture} team quota fixture org reset`,
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
    label: `${fixture} team quota fixture login`,
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

function runFreeTeamProbe(env) {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-team-free-"));
  const orgSlug = "quota-team-free";

  try {
    loginFixture(env, "free", homeDir);
    createOrganization(env, homeDir, orgSlug, "free team probe org create");

    const result = runCli({
      env,
      homeDir,
      args: ["org", "team", "add", orgSlug, "core", "--name", "Core Team", "--json"],
      label: "free team create",
    });
    assert(result.status === 1, "free team create should fail");
    const payload = parseJson(result.stdout, "free team create");
    assert(payload?.error?.code === "forbidden", "free team create expected forbidden");
    assert(
      payload?.error?.message === "teams are available on pro accounts only",
      "free team create expected plan message",
    );
    assert(
      payload?.error?.details?.reason === "forbidden_plan",
      "free team create expected forbidden_plan",
    );

    return { fixture: "free", orgSlug, blockedTeamSlug: "core" };
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

function runProTeamProbe(env) {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-team-pro-"));
  const orgSlug = "quota-team-pro";

  try {
    loginFixture(env, "pro", homeDir);
    createOrganization(env, homeDir, orgSlug, "pro team probe org create");

    for (let index = 1; index <= 5; index += 1) {
      const teamSlug = `team-${String(index).padStart(2, "0")}`;
      const result = runCli({
        env,
        homeDir,
        args: ["org", "team", "add", orgSlug, teamSlug, "--name", `Team ${index}`, "--json"],
        label: `pro team create ${teamSlug}`,
      });
      assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
      const payload = parseJson(result.stdout, result.label);
      assert(payload?.teamSlug === teamSlug, `${result.label} returned unexpected teamSlug`);
    }

    const overflow = runCli({
      env,
      homeDir,
      args: ["org", "team", "add", orgSlug, "team-06", "--name", "Team 6", "--json"],
      label: "pro team overflow create",
    });
    assert(overflow.status === 1, "pro team overflow should fail");
    const overflowPayload = parseJson(overflow.stdout, overflow.label);
    assert(
      overflowPayload?.error?.code === "plan_limit_exceeded",
      "pro team overflow expected plan_limit_exceeded",
    );
    assert(
      overflowPayload?.error?.message === "pro organizations can create up to 5 teams",
      "pro team overflow expected quota message",
    );

    const listResult = runCli({
      env,
      homeDir,
      args: ["org", "team", "ls", orgSlug, "--json"],
      label: "pro team ls",
    });
    assert(listResult.status === 0, "pro team ls failed");
    const listPayload = parseJson(listResult.stdout, listResult.label);
    const teams = Array.isArray(listPayload?.teams) ? listPayload.teams : [];
    assert(teams.length === 5, `pro team ls expected 5 teams, received ${teams.length}`);

    return {
      fixture: "pro",
      orgSlug,
      createdTeams: teams.map((team) => team.teamSlug),
      overflowTeamSlug: "team-06",
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

  const freeResult = runFreeTeamProbe(config);
  const proResult = runProTeamProbe(config);

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
