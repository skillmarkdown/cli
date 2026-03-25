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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function signInWithPassword(env, fixture) {
  const email = fixture.email;
  const password = fixture.password;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.firebaseApiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.idToken) {
    throw new Error(`sign in failed for ${email}`);
  }
  return payload.idToken;
}

async function registryJsonRequest(env, idToken, path, method, body) {
  const response = await fetch(`${env.registryBaseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
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

function ensureFixtureUser(env, fixture) {
  const isPro = fixture === "pro";
  const email = isPro ? env.proEmail : env.freeEmail;
  const password = isPro ? env.proPassword : env.freePassword;
  const username = isPro ? env.proUsername : env.freeUsername;
  const plan = isPro ? "pro" : "free";

  const stdout = runNodeScript({
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
    label: `${fixture} throttle fixture user`,
  });
  const payload = parseJson(stdout, `${fixture} throttle fixture user`);

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
    label: `${fixture} throttle fixture plan`,
  });

  return {
    uid: payload.uid,
    email,
    username,
    password,
    plan,
  };
}

function resetRateLimits(env, routeClasses, keys) {
  const args = ["scripts/reset-rate-limits.mjs", "--project", env.firebaseProjectId];
  for (const routeClass of routeClasses) {
    args.push("--route-class", routeClass);
  }
  for (const key of keys) {
    args.push("--key", key);
  }

  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args,
    label: `reset rate limits ${routeClasses.join(",")}`,
  });
}

function resetFixtureOrganizations(env, email, prefix) {
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: [
      "scripts/reset-user-organizations.mjs",
      "--project",
      env.firebaseProjectId,
      "--email",
      email,
      "--prefix",
      prefix,
    ],
    label: `reset organizations ${email}`,
  });
}

function resetFixtureTokens(env, email) {
  runNodeScript({
    cwd: FUNCTIONS_DIR,
    env: process.env,
    args: ["scripts/reset-user-tokens.mjs", "--project", env.firebaseProjectId, "--email", email],
    label: `reset tokens ${email}`,
  });
}

function loginFixture(env, fixture, homeDir) {
  runNodeScript({
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      ...env,
      HOME: homeDir,
      SKILLMD_LOGIN_EMAIL: fixture.email,
      SKILLMD_LOGIN_PASSWORD: fixture.password,
    },
    args: [CLI_PATH, "login", "--reauth"],
    label: `${fixture.username} login`,
  });
}

async function probeOrgCreateThrottle(env, fixture) {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-throttle-org-"));
  const prefix = "throttle-org";
  const principalKey = `uid:${fixture.uid}`;
  try {
    resetFixtureOrganizations(env, fixture.email, "");
    resetRateLimits(env, ["org_create_rate_limited"], [`org_create:${principalKey}`]);
    loginFixture(env, fixture, homeDir);
    const idToken = await signInWithPassword(env, fixture);

    for (let index = 1; index <= 3; index += 1) {
      const slug = `${prefix}-${String(index).padStart(2, "0")}`;
      const result = runCli({
        env,
        homeDir,
        args: ["org", "create", slug, "--json"],
        label: `org create ${slug}`,
      });
      assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
    }

    const blocked = await registryJsonRequest(env, idToken, "/v1/organizations", "POST", {
      slug: `${prefix}-04`,
    });
    assert(blocked.status === 429, "org create overflow should fail with 429");
    const payload = blocked.payload;
    assert(payload?.error?.code === "rate_limited", "expected org create rate_limited");
    assert(
      payload?.error?.details?.reason === "org_create_rate_limited",
      "expected org create rate-limited reason",
    );
  } finally {
    resetFixtureOrganizations(env, fixture.email, "");
    rmSync(homeDir, { recursive: true, force: true });
  }
}

async function probeUserTokenCreateThrottle(env, fixture) {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-throttle-user-token-"));
  const principalKey = `uid:${fixture.uid}`;
  try {
    resetFixtureTokens(env, fixture.email);
    resetRateLimits(env, ["user_token_create_rate_limited"], [`user_token_create:${principalKey}`]);
    loginFixture(env, fixture, homeDir);
    const idToken = await signInWithPassword(env, fixture);

    for (let index = 1; index <= 10; index += 1) {
      const result = runCli({
        env,
        homeDir,
        args: [
          "token",
          "add",
          `throttle-user-token-${String(index).padStart(2, "0")}`,
          "--scope",
          "publish",
          "--days",
          "7",
          "--json",
        ],
        label: `user token create ${index}`,
      });
      assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
    }

    const blocked = await registryJsonRequest(env, idToken, "/v1/auth/tokens", "POST", {
      name: "throttle-user-token-11",
      scope: "publish",
      expiresDays: 7,
    });
    assert(blocked.status === 429, "user token overflow should fail with 429");
    const payload = blocked.payload;
    assert(payload?.error?.code === "rate_limited", "expected user token rate_limited");
    assert(
      payload?.error?.details?.reason === "user_token_create_rate_limited",
      "expected user token rate-limited reason",
    );
  } finally {
    resetFixtureTokens(env, fixture.email);
    rmSync(homeDir, { recursive: true, force: true });
  }
}

function createProbeOrganization(env, homeDir, slug) {
  const result = runCli({
    env,
    homeDir,
    args: ["org", "create", slug, "--json"],
    label: `create probe org ${slug}`,
  });
  assert(result.status === 0, `${result.label} failed: ${result.stderr || result.stdout}`);
}

async function probeOrgTokenCreateThrottle(env, fixture) {
  const homeDir = mkdtempSync(join(tmpdir(), "skillmd-throttle-org-token-"));
  const orgSlug = "throttle-pro-org";
  const principalKey = `uid:${fixture.uid}`;
  try {
    resetFixtureOrganizations(env, fixture.email, "");
    resetFixtureTokens(env, fixture.email);
    resetRateLimits(
      env,
      ["org_create_rate_limited", "org_token_create_rate_limited"],
      [`org_create:${principalKey}`, `org_token_create:${principalKey}:${orgSlug}`],
    );
    loginFixture(env, fixture, homeDir);
    const idToken = await signInWithPassword(env, fixture);
    createProbeOrganization(env, homeDir, orgSlug);

    for (let index = 1; index <= 10; index += 1) {
      const createResult = runCli({
        env,
        homeDir,
        args: [
          "org",
          "tokens",
          "add",
          orgSlug,
          `org-token-${String(index).padStart(2, "0")}`,
          "--scope",
          "publish",
          "--days",
          "7",
          "--json",
        ],
        label: `org token create ${index}`,
      });
      assert(
        createResult.status === 0,
        `${createResult.label} failed: ${createResult.stderr || createResult.stdout}`,
      );
      const createPayload = parseJson(createResult.stdout, createResult.label);
      const revokeResult = runCli({
        env,
        homeDir,
        args: ["org", "tokens", "rm", orgSlug, createPayload.tokenId, "--json"],
        label: `org token revoke ${index}`,
      });
      assert(
        revokeResult.status === 0,
        `${revokeResult.label} failed: ${revokeResult.stderr || revokeResult.stdout}`,
      );
    }

    const blocked = await registryJsonRequest(
      env,
      idToken,
      `/v1/organizations/${encodeURIComponent(orgSlug)}/tokens`,
      "POST",
      {
        name: "org-token-11",
        scope: "publish",
        expiresDays: 7,
      },
    );
    assert(blocked.status === 429, "org token overflow should fail with 429");
    const payload = blocked.payload;
    assert(payload?.error?.code === "rate_limited", "expected org token rate_limited");
    assert(
      payload?.error?.details?.reason === "org_token_create_rate_limited",
      "expected org token rate-limited reason",
    );
  } finally {
    resetFixtureOrganizations(env, fixture.email, "");
    rmSync(homeDir, { recursive: true, force: true });
  }
}

async function main() {
  const env = loadInternalScriptEnv();
  const { config, missing } = resolveConfig(env);
  if (missing.length > 0) {
    throw new Error(`missing required environment values: ${missing.join(", ")}`);
  }

  ensureLocalPrerequisites();

  const freeFixture = ensureFixtureUser(config, "free");
  const proFixture = ensureFixtureUser(config, "pro");

  await probeOrgCreateThrottle(config, freeFixture);
  await probeUserTokenCreateThrottle(config, proFixture);
  await probeOrgTokenCreateThrottle(config, proFixture);

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "passed",
        project: config.firebaseProjectId,
        registryBaseUrl: config.registryBaseUrl,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
