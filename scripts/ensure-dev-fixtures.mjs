#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
const LANDING_DISCOVER_REFRESH_SCRIPT = join(
  FUNCTIONS_DIR,
  "scripts",
  "refresh-landing-discover.mjs",
);
const LANDING_MOST_POPULAR_REFRESH_SCRIPT = join(
  FUNCTIONS_DIR,
  "scripts",
  "refresh-landing-most-popular.mjs",
);
const LANDING_RECENT_REFRESH_SCRIPT = join(FUNCTIONS_DIR, "scripts", "refresh-landing-recent.mjs");

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
  if (!existsSync(LANDING_DISCOVER_REFRESH_SCRIPT)) {
    throw new Error(
      `landing discover refresh script not found at ${LANDING_DISCOVER_REFRESH_SCRIPT}`,
    );
  }
  if (!existsSync(LANDING_MOST_POPULAR_REFRESH_SCRIPT)) {
    throw new Error(
      `landing most popular refresh script not found at ${LANDING_MOST_POPULAR_REFRESH_SCRIPT}`,
    );
  }
  if (!existsSync(LANDING_RECENT_REFRESH_SCRIPT)) {
    throw new Error(`landing recent refresh script not found at ${LANDING_RECENT_REFRESH_SCRIPT}`);
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

    const members = runCliJson({
      env,
      homeDir: isolatedHome,
      args: ["org", "members", "ls", config.orgSlug, "--json"],
      label: "org members ls",
    });
    const memberUsernames = Array.isArray(members?.members)
      ? members.members
          .map((entry) => ({
            username: typeof entry?.username === "string" ? entry.username : "",
            role: typeof entry?.role === "string" ? entry.role : "",
          }))
          .filter((entry) => entry.username.length > 0)
      : [];
    const existingMember = memberUsernames.find(
      (entry) => entry.username === config.orgMemberUsername,
    );
    if (!existingMember) {
      runCliJson({
        env,
        homeDir: isolatedHome,
        args: [
          "org",
          "members",
          "add",
          config.orgSlug,
          config.orgMemberUsername,
          "--role",
          "owner",
          "--json",
        ],
        label: "org members add",
      });
    } else if (existingMember.role !== "owner") {
      runCliJson({
        env,
        homeDir: isolatedHome,
        args: ["org", "members", "rm", config.orgSlug, config.orgMemberUsername, "--json"],
        label: "org members rm",
      });
      runCliJson({
        env,
        homeDir: isolatedHome,
        args: [
          "org",
          "members",
          "add",
          config.orgSlug,
          config.orgMemberUsername,
          "--role",
          "owner",
          "--json",
        ],
        label: "org members add",
      });
    }
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true });
  }
}

function ensureOrganizationSkill(env, config) {
  const isolatedHome = mkdtempSync(join(tmpdir(), "skillmd-fixtures-org-skill-home-"));
  const tempRoot = mkdtempSync(join(tmpdir(), "skillmd-fixtures-org-skill-"));
  const skillDir = join(tempRoot, config.orgSkillSlug);
  try {
    mkdirSync(skillDir, { recursive: true });

    runNodeScript({
      cwd: ROOT_DIR,
      env: {
        ...env,
        HOME: isolatedHome,
        SKILLMD_LOGIN_EMAIL: config.loginEmail,
        SKILLMD_LOGIN_PASSWORD: config.loginPassword,
      },
      args: [CLI_PATH, "login", "--reauth"],
      label: "org owner fixture login",
    });

    runNodeScript({
      cwd: skillDir,
      env: {
        ...env,
        HOME: isolatedHome,
      },
      args: [CLI_PATH, "init", "--template", "verbose"],
      label: "org skill init",
    });

    runCliJson({
      env,
      homeDir: isolatedHome,
      args: [
        "publish",
        skillDir,
        "--version",
        "1.0.0",
        "--tag",
        "latest",
        "--access",
        "public",
        "--owner",
        `@${config.orgSlug}`,
        "--agent-target",
        "skillmd",
        "--json",
      ],
      label: "org skill publish",
    });
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true });
    rmSync(tempRoot, { recursive: true, force: true });
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

function refreshLandingAggregates(env, config) {
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: [LANDING_DISCOVER_REFRESH_SCRIPT, "--project", config.firebaseProjectId],
    label: "landing discover refresh",
  });
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: [LANDING_MOST_POPULAR_REFRESH_SCRIPT, "--project", config.firebaseProjectId],
    label: "landing most popular refresh",
  });
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env,
    args: [LANDING_RECENT_REFRESH_SCRIPT, "--project", config.firebaseProjectId],
    label: "landing recent refresh",
  });
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
  ensureOrganizationSkill(env, config);

  console.log("Verifying pro entitlements...");
  verifyProFixture(env, config);

  console.log("Ensuring private search seed corpus...");
  const privateSearchSeed = ensurePrivateSearchSeed(env, config);

  console.log("Refreshing landing aggregates...");
  refreshLandingAggregates(env, config);

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
        orgMemberUsername: config.orgMemberUsername,
        orgSkillSlug: config.orgSkillSlug,
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
