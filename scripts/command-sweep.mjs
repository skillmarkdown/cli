#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { pickFirstNonEmpty, sanitizeStepForOutput } from "./command-sweep-utils.mjs";
import { getMatrixCommands } from "./command-matrix.mjs";
import { DEV_FIXTURE_DEFAULTS } from "./ensure-dev-fixtures-lib.mjs";
import { loadInternalScriptEnv } from "./internal-env.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(ROOT_DIR, "dist", "cli.js");

const ENV_PROFILES = {
  dev: {
    firebaseProjectId: "skillmarkdown-development",
    registryBaseUrl: "https://registryapi-sm46rm3rja-uc.a.run.app",
  },
  prod: {
    firebaseProjectId: "skillmarkdown",
    registryBaseUrl: "https://registry.skillmarkdown.com",
  },
};

const PROD_DEFAULT_API_KEY = "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok";
const RUN_ID = `${Date.now()}`;
const INTERNAL_ENV = loadInternalScriptEnv();
const PRIVATE_CURSOR_QUERY = INTERNAL_ENV.SKILLMD_E2E_PRIVATE_CURSOR_QUERY || "cursorseed";
const MATRIX_COMMANDS = getMatrixCommands();

function parseOwnedSkillId(skillId) {
  if (typeof skillId !== "string" || skillId.trim().length === 0) {
    throw new Error("owned skill id is not set");
  }

  if (!skillId.includes("/")) {
    return { owner: "", skillSlug: skillId };
  }

  const [owner, skillSlug] = skillId.split("/");
  return { owner, skillSlug };
}

function parseArgs(argv) {
  const parsed = {
    env: "dev",
    write: false,
    extended: false,
    allowAuthBlocked: false,
    keepWorkspace: false,
    reportFile: null,
    workspace: null,
    strict: false,
    tier: "core",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("missing value for --env (expected: dev|prod|both)");
      }
      parsed.env = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--env=")) {
      parsed.env = arg.slice("--env=".length);
      continue;
    }
    if (arg === "--write") {
      parsed.write = true;
      continue;
    }
    if (arg === "--extended") {
      parsed.extended = true;
      continue;
    }
    if (arg === "--allow-auth-blocked") {
      parsed.allowAuthBlocked = true;
      continue;
    }
    if (arg === "--keep-workspace") {
      parsed.keepWorkspace = true;
      continue;
    }
    if (arg === "--strict") {
      parsed.strict = true;
      continue;
    }
    if (arg === "--tier") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("missing value for --tier (expected: core|extended|all)");
      }
      parsed.tier = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--tier=")) {
      parsed.tier = arg.slice("--tier=".length);
      continue;
    }
    if (arg === "--report-file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("missing value for --report-file");
      }
      parsed.reportFile = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--report-file=")) {
      parsed.reportFile = resolve(arg.slice("--report-file=".length));
      continue;
    }
    if (arg === "--workspace") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("missing value for --workspace");
      }
      parsed.workspace = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--workspace=")) {
      parsed.workspace = resolve(arg.slice("--workspace=".length));
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }
    throw new Error(`unsupported argument: ${arg}`);
  }

  if (!["dev", "prod", "both"].includes(parsed.env)) {
    throw new Error(`invalid --env '${parsed.env}' (expected: dev|prod|both)`);
  }
  if (!["core", "extended", "all"].includes(parsed.tier)) {
    throw new Error(`invalid --tier '${parsed.tier}' (expected: core|extended|all)`);
  }
  if (parsed.extended && parsed.tier === "core") {
    parsed.tier = "all";
  }
  return parsed;
}

function printUsageAndExit(code) {
  console.log(
    [
      "Usage: node scripts/command-sweep.mjs [options]",
      "",
      "Options:",
      "  --env <dev|prod|both>     Target environment profile(s). Default: dev",
      "  --tier <core|extended|all> Select the scenario tier. Default: core",
      "  --strict                  Run strict release-gate assertions",
      "  --write                   Legacy compatibility; implies mutation scenarios",
      "  --extended                Legacy compatibility; expands tier to all",
      "  --allow-auth-blocked      Legacy exploratory mode only",
      "  --workspace <path>        Reuse a fixed workspace path",
      "  --keep-workspace          Keep temp workspace after run",
      "  --report-file <path>      Write JSON report to file",
      "  --help                    Show this help",
    ].join("\n"),
  );
  process.exit(code);
}

function createProfileEnv(profileName) {
  const profile = ENV_PROFILES[profileName];
  if (!profile) {
    throw new Error(`unknown profile: ${profileName}`);
  }

  const env = {
    ...INTERNAL_ENV,
    SKILLMD_FIREBASE_PROJECT_ID: profile.firebaseProjectId,
    SKILLMD_REGISTRY_BASE_URL: profile.registryBaseUrl,
  };

  if (profileName === "dev") {
    const devKey = pickFirstNonEmpty(
      INTERNAL_ENV.SKILLMD_DEV_FIREBASE_API_KEY,
      INTERNAL_ENV.SKILLMD_FIREBASE_API_KEY,
    );
    if (devKey) {
      env.SKILLMD_FIREBASE_API_KEY = devKey;
    }
  } else {
    const prodKey = pickFirstNonEmpty(
      INTERNAL_ENV.SKILLMD_PROD_FIREBASE_API_KEY,
      PROD_DEFAULT_API_KEY,
    );
    env.SKILLMD_FIREBASE_API_KEY = prodKey;
  }

  return env;
}

function hasLoginCredentials(env) {
  return Boolean(env.SKILLMD_LOGIN_EMAIL?.trim() && env.SKILLMD_LOGIN_PASSWORD?.trim());
}

function hasProLoginCredentials(env) {
  return Boolean(env.SKILLMD_PRO_LOGIN_EMAIL?.trim() && env.SKILLMD_PRO_LOGIN_PASSWORD?.trim());
}

function withProLoginCredentials(env) {
  return {
    ...env,
    SKILLMD_LOGIN_EMAIL: env.SKILLMD_PRO_LOGIN_EMAIL,
    SKILLMD_LOGIN_PASSWORD: env.SKILLMD_PRO_LOGIN_PASSWORD,
  };
}

function hasOrgFixtures(env) {
  return Boolean(env.SKILLMD_E2E_ORG_SLUG?.trim());
}

function inferCommandFromArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return "root";
  }

  const [first] = args;
  return typeof first === "string" && !first.startsWith("-") ? first : "root";
}

function runCli({ env, cwd, args }) {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`;

  return {
    args,
    cwd,
    exitCode: typeof result.status === "number" ? result.status : 1,
    stdout,
    stderr,
    combined,
    durationMs: Date.now() - startedAt,
  };
}

function parseJsonPayload(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureFile(path) {
  assert(existsSync(path), `expected file to exist: ${path}`);
}

function printStep(result, state) {
  const safeResult = sanitizeStepForOutput(result);
  const statusLabel = safeResult.status.toUpperCase();
  const command = `skillmd ${safeResult.args.join(" ")}`;
  console.log(`\n[${statusLabel}] ${result.name}`);
  console.log(`  cwd: ${safeResult.cwd}`);
  console.log(`  cmd: ${command}`);
  console.log(`  exit: ${safeResult.exitCode} (${safeResult.durationMs}ms)`);
  if (safeResult.detail) {
    console.log(`  detail: ${safeResult.detail}`);
  }
  const output =
    safeResult.stdout || safeResult.stderr
      ? `${safeResult.stdout}${safeResult.stderr ? `\n${safeResult.stderr}` : ""}`
      : "";
  if (output.trim()) {
    console.log("  output:");
    for (const line of output.trimEnd().split(/\r?\n/)) {
      console.log(`    ${line}`);
    }
  }

  state.counts[safeResult.status] += 1;
  state.steps.push(safeResult);
}

function classifyResult({
  raw,
  kind,
  expectedPattern,
  acceptedExitCodes,
  strict,
  allowAuthBlocked,
  required,
  skipReason,
  validate,
}) {
  if (skipReason) {
    return {
      ...raw,
      status: strict && required ? "fail" : "skipped",
      detail: strict && required ? `required step skipped: ${skipReason}` : skipReason,
    };
  }

  let status;
  if (Array.isArray(acceptedExitCodes) && acceptedExitCodes.length > 0) {
    const matchedExpectedPattern = expectedPattern ? expectedPattern.test(raw.combined) : true;
    status = acceptedExitCodes.includes(raw.exitCode) && matchedExpectedPattern ? "pass" : "fail";
  } else if (kind === "expected_error") {
    const matchedExpectedPattern = expectedPattern ? expectedPattern.test(raw.combined) : true;
    status = raw.exitCode !== 0 && matchedExpectedPattern ? "pass" : "fail";
  } else {
    const matchedExpectedPattern = expectedPattern ? expectedPattern.test(raw.combined) : true;
    status = raw.exitCode === 0 && matchedExpectedPattern ? "pass" : "fail";
  }

  if (
    !strict &&
    allowAuthBlocked &&
    status === "fail" &&
    /(PROJECT_NUMBER_MISMATCH|unauthorized|not logged in|refresh token is revoked|missing authentication token|secure token exchange failed|forbidden)/i.test(
      raw.combined,
    )
  ) {
    status = "blocked";
  }

  let detail = null;
  if (status === "pass" && typeof validate === "function") {
    try {
      const validation = validate(raw);
      if (typeof validation === "string" && validation.trim().length > 0) {
        status = "fail";
        detail = validation;
      }
    } catch (error) {
      status = "fail";
      detail = error instanceof Error ? error.message : "validation failed";
    }
  }

  return {
    ...raw,
    status,
    detail,
  };
}

function runScenarioStep(state, config) {
  const raw = config.skipReason
    ? {
        name: config.name,
        args: config.args,
        cwd: config.cwd,
        exitCode: -1,
        stdout: "",
        stderr: config.skipReason,
        combined: config.skipReason,
        durationMs: 0,
      }
    : {
        ...runCli({ env: config.env, cwd: config.cwd, args: config.args }),
        name: config.name,
      };

  const finalized = classifyResult({
    raw,
    kind: config.kind ?? "success",
    expectedPattern: config.expectedPattern,
    acceptedExitCodes: config.acceptedExitCodes,
    strict: config.strict,
    allowAuthBlocked: config.allowAuthBlocked,
    required: config.required ?? true,
    skipReason: config.skipReason ?? null,
    validate: config.validate,
  });

  finalized.command = config.command ?? inferCommandFromArgs(config.args);
  finalized.coverageKind = config.coverageKind ?? "spawned";
  finalized.required = config.required ?? true;

  printStep(finalized, state);
  return finalized;
}

function summarizeOutcome(state) {
  if (state.counts.fail > 0) {
    return 2;
  }
  if (state.counts.blocked > 0) {
    return 3;
  }
  return 0;
}

function buildCommandCoverage(results) {
  const liveCommands = new Set();
  const spawnedCommands = new Set();

  for (const result of results) {
    for (const step of result.steps ?? []) {
      if (step.status !== "pass" || typeof step.command !== "string") {
        continue;
      }
      if (step.coverageKind === "live-auth") {
        liveCommands.add(step.command);
        continue;
      }
      spawnedCommands.add(step.command);
    }
  }

  const coverage = {};
  for (const command of Array.from(MATRIX_COMMANDS).sort()) {
    if (liveCommands.has(command)) {
      coverage[command] = "live-auth-covered";
    } else if (spawnedCommands.has(command)) {
      coverage[command] = "spawned-covered";
    } else {
      coverage[command] = "unit-only";
    }
  }

  return coverage;
}

function preflightOrThrow({ profileName, strict, tier, env }) {
  if (!strict) {
    return;
  }

  if (profileName !== "dev") {
    throw new Error("strict release-gate sweep only supports --env dev");
  }

  const requiredCoreEnv = [
    "SKILLMD_FIREBASE_API_KEY",
    "SKILLMD_LOGIN_EMAIL",
    "SKILLMD_LOGIN_PASSWORD",
    "SKILLMD_PRO_LOGIN_EMAIL",
    "SKILLMD_PRO_LOGIN_PASSWORD",
    "SKILLMD_E2E_ORG_SLUG",
  ];
  const missingCore = requiredCoreEnv.filter((key) => !env[key]?.trim());
  if (missingCore.length > 0) {
    throw new Error(`missing strict core prerequisites: ${missingCore.join(", ")}`);
  }

  if (tier === "extended" || tier === "all") {
    const requiredExtendedEnv = ["SKILLMD_E2E_ORG_SLUG"];
    const missingExtended = requiredExtendedEnv.filter((key) => !env[key]?.trim());
    if (missingExtended.length > 0) {
      throw new Error(`missing strict extended prerequisites: ${missingExtended.join(", ")}`);
    }
  }
}

function setupWorkspace(profileName, workspaceOverride) {
  const workspace = workspaceOverride
    ? resolve(workspaceOverride, `skillmd-sweep-${profileName}`)
    : mkdtempSync(join(tmpdir(), `skillmd-sweep-${profileName}-`));
  mkdirSync(workspace, { recursive: true });
  return workspace;
}

function createSweepState({ profileName, strict, tier, workspace }) {
  return {
    profile: profileName,
    strict,
    tier,
    workspace,
    counts: { pass: 0, fail: 0, blocked: 0, skipped: 0 },
    steps: [],
  };
}

function makeCoreContext(workspace) {
  const isolatedHomeDir = join(workspace, "isolated-home");
  const anonymousHomeDir = join(workspace, "anonymous-home");
  const globalHomeDir = join(workspace, "global-home");
  const proHomeDir = join(workspace, "pro-home");
  const initDir = join(workspace, "init-verbose");
  const publishDir = join(workspace, `publish-skill-${RUN_ID}`);
  const freePrivatePublishDir = join(workspace, `free-private-skill-${RUN_ID}`);
  const proPrivatePublishDir = join(workspace, `pro-private-skill-${RUN_ID}`);
  const workDir = join(workspace, "work");
  const globalWorkDir = join(workspace, "global-work");
  mkdirSync(isolatedHomeDir, { recursive: true });
  mkdirSync(anonymousHomeDir, { recursive: true });
  mkdirSync(globalHomeDir, { recursive: true });
  mkdirSync(proHomeDir, { recursive: true });
  mkdirSync(initDir, { recursive: true });
  mkdirSync(publishDir, { recursive: true });
  mkdirSync(freePrivatePublishDir, { recursive: true });
  mkdirSync(proPrivatePublishDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(globalWorkDir, { recursive: true });
  return {
    isolatedHomeDir,
    anonymousHomeDir,
    globalHomeDir,
    proHomeDir,
    initDir,
    publishDir,
    freePrivatePublishDir,
    proPrivatePublishDir,
    workDir,
    globalWorkDir,
    ownedSkillId: null,
    ownedVersion: "1.0.0",
    freePrivateVersion: "1.0.0",
    proPrivateVersion: "1.0.0",
    installedPath: null,
    manifestInstallPath: null,
    globalInstalledPath: null,
    globalManifestInstallPath: null,
    proOwnedSkillId: null,
    proPlan: null,
    privateCursorQuery: PRIVATE_CURSOR_QUERY,
    privateCursorNext: null,
  };
}

function validateWhoami(raw) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && typeof payload.owner === "string", "whoami did not return owner");
  assert(typeof payload.username === "string", "whoami did not return username");
}

function captureWhoamiPlan(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && typeof payload.owner === "string", "whoami did not return owner");
    assert(typeof payload.username === "string", "whoami did not return username");
    ctx.proPlan = typeof payload.plan === "string" ? payload.plan : null;
  };
}

function validatePublishReal(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && typeof payload.skillId === "string", "publish did not return skillId");
    assert(typeof payload.version === "string", "publish did not return version");
    ctx.ownedSkillId = payload.skillId;
    ctx.ownedVersion = payload.version;
  };
}

function validateSearch(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.results), "search did not return results");
    assert(
      payload.results.some((item) => item && item.skillId === ctx.ownedSkillId),
      `search results did not include ${ctx.ownedSkillId}`,
    );
  };
}

function validatePublishPlanDenied(raw) {
  assert(raw.exitCode !== 0, "private publish should fail for free plan");
  assert(
    /private publish is not allowed|private skills require a Pro plan/i.test(raw.combined),
    "expected private publish plan-denial contract",
  );
}

function validatePrivatePublishReal(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(
      payload && typeof payload.skillId === "string",
      "private publish did not return skillId",
    );
    assert(typeof payload.version === "string", "private publish did not return version");
    ctx.proOwnedSkillId = payload.skillId;
    ctx.proPrivateVersion = payload.version;
  };
}

function validateSearchSuccess(options = {}) {
  const { expectQuery, expectedLimit, minResults } = options;
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.results), "search did not return results");
    if (expectQuery !== undefined) {
      assert(payload.query === expectQuery, `search query mismatch: expected ${expectQuery}`);
    }
    if (expectedLimit !== undefined) {
      assert(payload.limit === expectedLimit, `search limit mismatch: expected ${expectedLimit}`);
    }
    if (minResults !== undefined) {
      assert(
        payload.results.length >= minResults,
        `expected at least ${minResults} search result(s)`,
      );
    }
    assert(
      payload.nextCursor === null || typeof payload.nextCursor === "string",
      "search nextCursor shape invalid",
    );
  };
}

function validatePrivateSearchContract(raw) {
  if (raw.exitCode === 0) {
    validateSearchSuccess({ expectedLimit: 1 })(raw);
    return;
  }

  assert(
    /private search is not allowed|private skills require a Pro plan/i.test(raw.combined),
    "expected private search denial contract",
  );
}

function validatePrivateSearchContains(skillId) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.results), "private search did not return results");
    assert(
      payload.results.some((item) => item && item.skillId === skillId),
      `private search results did not include ${skillId}`,
    );
  };
}

function validatePrivateSearchPage(ctx, options = {}) {
  const { expectQuery, expectedLimit, requireNextCursor = false } = options;
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.results), "private search did not return results");
    if (typeof expectQuery === "string") {
      assert(
        payload.query === expectQuery,
        `private search query mismatch: expected ${expectQuery}`,
      );
    }
    if (typeof expectedLimit === "number") {
      assert(
        payload.limit === expectedLimit,
        `private search limit mismatch: expected ${expectedLimit}`,
      );
    }
    assert(payload.results.length > 0, "private search returned no results");
    if (requireNextCursor) {
      assert(
        typeof payload.nextCursor === "string" && payload.nextCursor.length > 0,
        "expected nextCursor",
      );
    } else {
      assert(
        payload.nextCursor === null || typeof payload.nextCursor === "string",
        "private search nextCursor shape invalid",
      );
    }
    ctx.privateCursorNext = payload.nextCursor ?? null;
  };
}

function validateSearchEmpty(raw) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.results), "search did not return results");
  assert(payload.results.length === 0, "expected empty search results");
}

function validateSearchDenied(raw) {
  assert(raw.exitCode !== 0, "anonymous search should fail");
  assert(
    /(search requires login|not logged in|missing authentication token|authentication required)/i.test(
      raw.combined,
    ),
    "expected anonymous search denial message",
  );
}

function validateView(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    const parsed = parseOwnedSkillId(ctx.ownedSkillId);
    assert(payload, "view did not return payload");
    if (parsed.owner) {
      assert(payload.owner === parsed.owner, "view owner mismatch");
    } else {
      assert(
        typeof payload.owner === "string" && payload.owner.startsWith("@"),
        "view owner missing",
      );
      assert(
        typeof payload.username === "string" && payload.owner === `@${payload.username}`,
        "view owner/username mismatch",
      );
    }
    assert(payload.skill === parsed.skillSlug, "view skill mismatch");
  };
}

function validateHistory(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.results), "history did not return results");
    assert(
      payload.results.some((item) => item && item.version === ctx.ownedVersion),
      `history did not include ${ctx.ownedVersion}`,
    );
  };
}

function validateTagList(tagName, shouldExist = true) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && payload.distTags && typeof payload.distTags === "object", "tag ls invalid");
    const hasTag = Object.prototype.hasOwnProperty.call(payload.distTags, tagName);
    assert(hasTag === shouldExist, `tag ${tagName} presence mismatch`);
  };
}

function validateTagListEventually({
  tagName,
  shouldExist = true,
  env,
  cwd,
  skillId,
  strict,
  allowAuthBlocked,
}) {
  return (raw) => {
    let lastRaw = raw;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        validateTagList(tagName, shouldExist)(lastRaw);
        return;
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        lastRaw = runCli({ env, cwd, args: ["tag", "ls", skillId, "--json"] });
        const classified = classifyResult({
          raw: { ...lastRaw, name: "tag-ls-after-rm-retry" },
          kind: "success",
          strict,
          allowAuthBlocked,
          required: true,
          skipReason: null,
        });
        if (classified.status !== "pass") {
          throw new Error(classified.detail ?? classified.combined ?? "tag ls retry failed", {
            cause: error,
          });
        }
      }
    }
  };
}

function validateInstalledPath(raw, targetSetter) {
  const payload = parseJsonPayload(raw.stdout);
  const entry =
    payload?.installed?.[0] ??
    payload?.updated?.[0] ??
    payload?.result ??
    payload?.entries?.[0] ??
    payload;
  const installedPath = entry?.installedPath;
  assert(typeof installedPath === "string", "expected installedPath in JSON output");
  ensureFile(join(installedPath, "SKILL.md"));
  if (typeof targetSetter === "function") {
    targetSetter(installedPath);
  }
}

function validateListContains(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.entries), "list did not return entries");
    assert(
      payload.entries.some((entry) => entry && entry.skillId === ctx.ownedSkillId),
      `list did not include ${ctx.ownedSkillId}`,
    );
  };
}

function validateListContainsWithTarget(ctx, agentTarget, installScope = "workspace") {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.entries), "list did not return entries");
    assert(payload.scope === installScope, `list scope mismatch: expected ${installScope}`);
    assert(
      payload.entries.some(
        (entry) => entry && entry.skillId === ctx.ownedSkillId && entry.agentTarget === agentTarget,
      ),
      `list did not include ${ctx.ownedSkillId} for ${agentTarget}`,
    );
    assert(
      payload.entries.every((entry) => !entry || entry.agentTarget === agentTarget),
      `list contained entries outside ${agentTarget}`,
    );
  };
}

function validateListMissing(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.entries), "list did not return entries");
    assert(
      !payload.entries.some((entry) => entry && entry.skillId === ctx.ownedSkillId),
      `list still included ${ctx.ownedSkillId}`,
    );
  };
}

function validateListMissingWithTarget(ctx, agentTarget, installScope = "workspace") {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.entries), "list did not return entries");
    assert(payload.scope === installScope, `list scope mismatch: expected ${installScope}`);
    assert(
      !payload.entries.some(
        (entry) => entry && entry.skillId === ctx.ownedSkillId && entry.agentTarget === agentTarget,
      ),
      `list still included ${ctx.ownedSkillId} for ${agentTarget}`,
    );
  };
}

function validateInstallJson(raw, ctx) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.installed), "install did not report installed entries");
  const installedEntry = payload.installed.find(
    (entry) => entry && entry.skillId === ctx.ownedSkillId,
  );
  assert(installedEntry, `install did not include ${ctx.ownedSkillId}`);
  ensureFile(join(installedEntry.installedPath, "SKILL.md"));
  ctx.manifestInstallPath = installedEntry.installedPath;
}

function validateInstallJsonWithTarget(ctx, agentTarget, installScope = "workspace") {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && Array.isArray(payload.installed), "install did not report installed entries");
    const installedEntry = payload.installed.find(
      (entry) => entry && entry.skillId === ctx.ownedSkillId && entry.agentTarget === agentTarget,
    );
    assert(installedEntry, `install did not include ${ctx.ownedSkillId} for ${agentTarget}`);
    ensureFile(join(installedEntry.installedPath, "SKILL.md"));
    if (installScope === "global") {
      ctx.globalManifestInstallPath = installedEntry.installedPath;
    }
  };
}

function validateInstallPrune(raw, ctx) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.pruned), "install --prune did not report pruned entries");
  assert(
    payload.pruned.some(
      (entry) => entry && entry.skillId === ctx.ownedSkillId && entry.status === "pruned",
    ),
    `install --prune did not prune ${ctx.ownedSkillId}`,
  );
  assert(!existsSync(ctx.manifestInstallPath), "pruned install path still exists");
}

function validateUpdateJson(raw) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && typeof payload.total === "number", "update did not return total");
  assert(
    Array.isArray(payload.updated) || Array.isArray(payload.failed),
    "update JSON shape invalid",
  );
}

function validateUpdateJsonWithTarget(skillId, agentTarget) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    assert(payload && typeof payload.total === "number", "update did not return total");
    const updatedOrSkipped = [...(payload.updated ?? []), ...(payload.skipped ?? [])];
    assert(
      updatedOrSkipped.some(
        (entry) => entry && entry.skillId === skillId && entry.agentTarget === agentTarget,
      ),
      `update did not include ${skillId} for ${agentTarget}`,
    );
    assert(
      updatedOrSkipped.every((entry) => !entry || entry.agentTarget === agentTarget),
      `update included entries outside ${agentTarget}`,
    );
  };
}

function validateRemoveJson(raw, ctx) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && typeof payload.removed === "number", "remove did not report removed count");
  if (ctx.installedPath) {
    assert(!existsSync(ctx.installedPath), "removed install path still exists");
  }
}

function validateRemoveJsonGlobal(raw, ctx) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && typeof payload.removed === "number", "remove did not report removed count");
  if (ctx.globalInstalledPath) {
    assert(!existsSync(ctx.globalInstalledPath), "removed global install path still exists");
  }
}

function validateDeprecatedUse(raw) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.warnings), "use did not return warnings");
  assert(
    payload.warnings.some((warning) => /deprecated/i.test(warning)),
    "missing deprecated warning",
  );
}

function validateHistoryEmpty(raw) {
  if (raw.exitCode !== 0) {
    assert(
      /skill not found|not_found/i.test(raw.combined),
      "expected empty history or skill not found after unpublish",
    );
    return;
  }
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.results), "history did not return results");
  assert(payload.results.length === 0, "expected empty history results");
}

function runCoreTier({ state, env, strict, allowAuthBlocked }) {
  const ctx = makeCoreContext(state.workspace);
  const stepEnv = { ...env, HOME: ctx.isolatedHomeDir };
  const proStepEnv = withProLoginCredentials({ ...env, HOME: ctx.proHomeDir });
  const authSkipReason =
    !strict && !hasLoginCredentials(stepEnv)
      ? "missing non-interactive login credentials for live auth sweep"
      : null;
  const proAuthSkipReason =
    !strict && !hasProLoginCredentials(env)
      ? "missing non-interactive pro credentials for live auth sweep"
      : null;
  const orgSkipReason =
    !strict && !hasOrgFixtures(stepEnv) ? "missing org fixture slug for live org sweep" : null;

  runScenarioStep(state, {
    name: "root-version",
    args: ["--version"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    command: "root",
  });
  runScenarioStep(state, {
    name: "root-version-short",
    args: ["-v"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    command: "root",
  });
  runScenarioStep(state, {
    name: "logout-preflight",
    args: ["logout"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    required: false,
  });
  runScenarioStep(state, {
    name: "login",
    args: ["login", "--reauth"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /Login successful/i,
    coverageKind: "live-auth",
    skipReason: authSkipReason,
  });
  runScenarioStep(state, {
    name: "login-status",
    args: ["login", "--status"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /(logged in|project:)/i,
    coverageKind: "live-auth",
    skipReason: authSkipReason,
  });
  runScenarioStep(state, {
    name: "whoami",
    args: ["whoami", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateWhoami,
    coverageKind: "live-auth",
    skipReason: authSkipReason,
  });
  runScenarioStep(state, {
    name: "init-verbose-no-validate",
    args: ["init", "--template", "verbose", "--no-validate"],
    cwd: ctx.initDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "validate",
    args: ["validate", ctx.initDir],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "validate-strict",
    args: ["validate", ctx.initDir, "--strict"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "init-publish",
    args: ["init", "--template", "verbose"],
    cwd: ctx.publishDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "init-free-private-publish",
    args: ["init", "--template", "verbose"],
    cwd: ctx.freePrivatePublishDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "init-pro-private-publish",
    args: ["init", "--template", "verbose"],
    cwd: ctx.proPrivatePublishDir,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    skipReason: proAuthSkipReason,
  });
  runScenarioStep(state, {
    name: "publish-dry-run",
    args: [
      "publish",
      ctx.publishDir,
      "--version",
      ctx.ownedVersion,
      "--tag",
      "latest",
      "--access",
      "public",
      "--agent-target",
      "skillmd",
      "--dry-run",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "publish-real",
    args: [
      "publish",
      ctx.publishDir,
      "--version",
      ctx.ownedVersion,
      "--tag",
      "latest",
      "--access",
      "public",
      "--agent-target",
      "skillmd",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validatePublishReal(ctx),
    coverageKind: "live-auth",
    skipReason: authSkipReason,
  });
  runScenarioStep(state, {
    name: "publish-private-denied-free",
    args: [
      "publish",
      ctx.freePrivatePublishDir,
      "--version",
      ctx.freePrivateVersion,
      "--tag",
      "latest",
      "--access",
      "private",
      "--agent-target",
      "skillmd",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    kind: "expected_error",
    validate: validatePublishPlanDenied,
    coverageKind: "live-auth",
    skipReason: authSkipReason,
  });

  if (!ctx.ownedSkillId) {
    return ctx;
  }

  const ownedSkill = parseOwnedSkillId(ctx.ownedSkillId);

  runScenarioStep(state, {
    name: "search-owned-skill",
    args: ["search", ownedSkill.skillSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateSearch(ctx),
  });
  runScenarioStep(state, {
    name: "search-empty",
    args: ["search", `missing-${RUN_ID}`, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateSearchEmpty,
  });
  runScenarioStep(state, {
    name: "search-private-limit",
    args: ["search", ownedSkill.skillSlug, "--scope", "private", "--limit", "1", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    acceptedExitCodes: [0, 1],
    validate: validatePrivateSearchContract,
    coverageKind: "live-auth",
  });
  const anonymousSearchEnv = {
    ...env,
    HOME: ctx.anonymousHomeDir,
  };
  delete anonymousSearchEnv.SKILLMD_AUTH_TOKEN;
  runScenarioStep(state, {
    name: "search-anonymous-denied",
    args: ["search", ownedSkill.skillSlug, "--json"],
    cwd: ROOT_DIR,
    env: anonymousSearchEnv,
    strict,
    allowAuthBlocked,
    validate: validateSearchDenied,
    kind: "expected_error",
    coverageKind: "live-auth",
  });
  runScenarioStep(state, {
    name: "pro-login",
    args: ["login", "--reauth"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /Login successful/i,
    coverageKind: "live-auth",
    skipReason: proAuthSkipReason,
  });
  runScenarioStep(state, {
    name: "pro-login-status",
    args: ["login", "--status"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /(logged in|project:)/i,
    coverageKind: "live-auth",
    skipReason: proAuthSkipReason,
  });
  runScenarioStep(state, {
    name: "pro-whoami",
    args: ["whoami", "--json"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    validate: captureWhoamiPlan(ctx),
    coverageKind: "live-auth",
    skipReason: proAuthSkipReason,
  });
  const proPrivateSkipReason =
    proAuthSkipReason ??
    (ctx.proPlan === "pro" ? null : "pro fixture does not currently have Pro-plan entitlements");
  const requireProPrivateChecks = proAuthSkipReason ? true : ctx.proPlan === "pro";
  runScenarioStep(state, {
    name: "publish-private-pro",
    args: [
      "publish",
      ctx.proPrivatePublishDir,
      "--version",
      ctx.proPrivateVersion,
      "--tag",
      "latest",
      "--access",
      "private",
      "--agent-target",
      "skillmd",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    validate: validatePrivatePublishReal(ctx),
    coverageKind: "live-auth",
    required: requireProPrivateChecks,
    skipReason: proPrivateSkipReason,
  });
  runScenarioStep(state, {
    name: "search-private-pro",
    args: ["search", `pro-private-skill-${RUN_ID}`, "--scope", "private", "--limit", "5", "--json"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      assert(ctx.proOwnedSkillId, "pro private publish did not return skill id");
      validatePrivateSearchContains(ctx.proOwnedSkillId)(raw);
    },
    coverageKind: "live-auth",
    required: requireProPrivateChecks,
    skipReason: proPrivateSkipReason,
  });
  runScenarioStep(state, {
    name: "search-private-pro-limit",
    args: ["search", ctx.privateCursorQuery, "--scope", "private", "--limit", "5", "--json"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    validate: validatePrivateSearchPage(ctx, {
      expectQuery: ctx.privateCursorQuery,
      expectedLimit: 5,
      requireNextCursor: true,
    }),
    coverageKind: "live-auth",
    required: requireProPrivateChecks,
    skipReason: proPrivateSkipReason,
  });
  runScenarioStep(state, {
    name: "search-private-pro-cursor",
    args: [
      "search",
      ctx.privateCursorQuery,
      "--scope",
      "private",
      "--limit",
      "5",
      "--cursor",
      ctx.privateCursorNext ?? "missing-cursor",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    validate: validatePrivateSearchPage(ctx, {
      expectQuery: ctx.privateCursorQuery,
      expectedLimit: 5,
    }),
    coverageKind: "live-auth",
    required: requireProPrivateChecks,
    skipReason: proPrivateSkipReason,
  });
  runScenarioStep(state, {
    name: "view-skill",
    args: ["view", ctx.ownedSkillId, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateView(ctx),
  });
  runScenarioStep(state, {
    name: "history-skill",
    args: ["history", ctx.ownedSkillId, "--limit", "5", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateHistory(ctx),
    coverageKind: "live-auth",
  });
  runScenarioStep(state, {
    name: "token-add",
    args: ["token", "add", `sweep-read-${RUN_ID}`, "--scope", "read", "--days", "1", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
  });
  let tokenId = null;
  const tokenAddStep = state.steps[state.steps.length - 1];
  if (tokenAddStep.status === "pass") {
    tokenId = parseJsonPayload(tokenAddStep.stdout)?.tokenId ?? null;
  }
  runScenarioStep(state, {
    name: "token-ls",
    args: ["token", "ls", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.tokens), "token ls invalid");
      assert(
        tokenId && payload.tokens.some((token) => token && token.tokenId === tokenId),
        "token missing from list",
      );
    },
  });
  runScenarioStep(state, {
    name: "token-rm",
    args: ["token", "rm", tokenId ?? "missing-token", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
    skipReason: tokenId ? null : "token add did not return tokenId",
  });
  runScenarioStep(state, {
    name: "org-ls",
    args: ["org", "ls", "--json"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
    skipReason: orgSkipReason,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.organizations), "org ls invalid");
      assert(
        payload.organizations.some((org) => org && org.slug === proStepEnv.SKILLMD_E2E_ORG_SLUG),
        `missing org ${proStepEnv.SKILLMD_E2E_ORG_SLUG}`,
      );
    },
  });
  runScenarioStep(state, {
    name: "org-tokens-add",
    args: [
      "org",
      "tokens",
      "add",
      proStepEnv.SKILLMD_E2E_ORG_SLUG ?? "missing-org",
      `sweep-org-${RUN_ID}`,
      "--scope",
      "admin",
      "--days",
      "1",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
    skipReason: orgSkipReason,
  });
  let orgTokenId = null;
  const orgTokenAddStep = state.steps[state.steps.length - 1];
  if (orgTokenAddStep.status === "pass") {
    orgTokenId = parseJsonPayload(orgTokenAddStep.stdout)?.tokenId ?? null;
  }
  runScenarioStep(state, {
    name: "org-tokens-ls",
    args: ["org", "tokens", "ls", proStepEnv.SKILLMD_E2E_ORG_SLUG ?? "missing-org", "--json"],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
    skipReason: orgSkipReason,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.tokens), "org tokens ls invalid");
      assert(
        orgTokenId && payload.tokens.some((token) => token && token.tokenId === orgTokenId),
        "org token missing from list",
      );
    },
  });
  runScenarioStep(state, {
    name: "org-tokens-rm",
    args: [
      "org",
      "tokens",
      "rm",
      proStepEnv.SKILLMD_E2E_ORG_SLUG ?? "missing-org",
      orgTokenId ?? "missing-token",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: proStepEnv,
    strict,
    allowAuthBlocked,
    coverageKind: "live-auth",
    skipReason: orgSkipReason || (orgTokenId ? null : "org token add did not return tokenId"),
  });
  runScenarioStep(state, {
    name: "tag-ls-before",
    args: ["tag", "ls", ctx.ownedSkillId, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateTagList("latest"),
  });
  runScenarioStep(state, {
    name: "tag-add",
    args: ["tag", "add", `${ctx.ownedSkillId}@${ctx.ownedVersion}`, "qa-sweep", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "tag-ls-after-add",
    args: ["tag", "ls", ctx.ownedSkillId, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateTagList("qa-sweep"),
  });
  runScenarioStep(state, {
    name: "tag-rm",
    args: ["tag", "rm", ctx.ownedSkillId, "qa-sweep", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "tag-ls-after-rm",
    args: ["tag", "ls", ctx.ownedSkillId, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateTagListEventually({
      tagName: "qa-sweep",
      shouldExist: false,
      env: stepEnv,
      cwd: ROOT_DIR,
      skillId: ctx.ownedSkillId,
      strict,
      allowAuthBlocked,
    }),
  });

  writeFileSync(
    join(ctx.workDir, "skills.json"),
    `${JSON.stringify(
      {
        version: 1,
        defaults: { agentTarget: "skillmd" },
        dependencies: {
          [ctx.ownedSkillId]: { spec: "latest" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  runScenarioStep(state, {
    name: "install",
    args: ["install", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => validateInstallJson(raw, ctx),
  });
  runScenarioStep(state, {
    name: "list-after-install",
    args: ["list", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateListContains(ctx),
  });
  runScenarioStep(state, {
    name: "install-agent-target-claude",
    args: ["install", "--agent-target", "claude", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateInstallJsonWithTarget(ctx, "claude"),
  });
  runScenarioStep(state, {
    name: "list-agent-target-claude",
    args: ["list", "--agent-target", "claude", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateListContainsWithTarget(ctx, "claude"),
  });

  writeFileSync(
    join(ctx.workDir, "skills.json"),
    `${JSON.stringify({ version: 1, defaults: { agentTarget: "skillmd" }, dependencies: {} }, null, 2)}\n`,
    "utf8",
  );

  runScenarioStep(state, {
    name: "install-prune",
    args: ["install", "--prune", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => validateInstallPrune(raw, ctx),
  });
  runScenarioStep(state, {
    name: "list-after-prune",
    args: ["list", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateListMissing(ctx),
  });

  runScenarioStep(state, {
    name: "use-default",
    args: ["use", ctx.ownedSkillId, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) =>
      validateInstalledPath(raw, (path) => {
        ctx.installedPath = path;
      }),
  });
  runScenarioStep(state, {
    name: "use-spec-latest",
    args: ["use", ctx.ownedSkillId, "--spec", "latest", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateInstalledPath,
  });
  runScenarioStep(state, {
    name: "use-version",
    args: ["use", ctx.ownedSkillId, "--version", ctx.ownedVersion, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateInstalledPath,
  });
  runScenarioStep(state, {
    name: "use-agent-target-claude",
    args: ["use", ctx.ownedSkillId, "--agent-target", "claude", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) =>
      validateInstalledPath(raw, (installedPath) => {
        ctx.installedPath = installedPath;
      }),
  });
  runScenarioStep(state, {
    name: "update-skill",
    args: ["update", ctx.ownedSkillId, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateUpdateJson,
  });
  runScenarioStep(state, {
    name: "update-agent-target-claude",
    args: ["update", ctx.ownedSkillId, "--agent-target", "claude", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateUpdateJsonWithTarget(ctx.ownedSkillId, "claude"),
  });
  runScenarioStep(state, {
    name: "update-all",
    args: ["update", "--all", "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateUpdateJson,
  });
  writeFileSync(
    join(ctx.globalWorkDir, "skills.json"),
    `${JSON.stringify(
      {
        version: 1,
        defaults: { agentTarget: "skillmd" },
        dependencies: {
          [ctx.ownedSkillId]: { spec: "latest", agentTarget: "claude" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const globalEnv = { ...env, HOME: ctx.globalHomeDir };
  const sourceSessionPath = join(ctx.isolatedHomeDir, ".skillmd", "auth.json");
  const targetSessionPath = join(ctx.globalHomeDir, ".skillmd", "auth.json");
  if (existsSync(sourceSessionPath)) {
    mkdirSync(dirname(targetSessionPath), { recursive: true });
    writeFileSync(targetSessionPath, readFileSync(sourceSessionPath, "utf8"), "utf8");
  }
  runScenarioStep(state, {
    name: "install-global",
    args: ["install", "--global", "--agent-target", "claude", "--json"],
    cwd: ctx.globalWorkDir,
    env: globalEnv,
    strict,
    allowAuthBlocked,
    validate: validateInstallJsonWithTarget(ctx, "claude", "global"),
  });
  runScenarioStep(state, {
    name: "list-global",
    args: ["list", "--global", "--agent-target", "claude", "--json"],
    cwd: ctx.globalWorkDir,
    env: globalEnv,
    strict,
    allowAuthBlocked,
    validate: validateListContainsWithTarget(ctx, "claude", "global"),
  });
  runScenarioStep(state, {
    name: "use-global",
    args: ["use", ctx.ownedSkillId, "--global", "--agent-target", "claude", "--json"],
    cwd: ctx.globalWorkDir,
    env: globalEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) =>
      validateInstalledPath(raw, (installedPath) => {
        ctx.globalInstalledPath = installedPath;
      }),
  });
  runScenarioStep(state, {
    name: "update-global",
    args: ["update", "--global", ctx.ownedSkillId, "--agent-target", "claude", "--json"],
    cwd: ctx.globalWorkDir,
    env: globalEnv,
    strict,
    allowAuthBlocked,
    validate: validateUpdateJsonWithTarget(ctx.ownedSkillId, "claude"),
  });
  runScenarioStep(state, {
    name: "remove-global",
    args: ["remove", ctx.ownedSkillId, "--global", "--agent-target", "claude", "--json"],
    cwd: ctx.globalWorkDir,
    env: globalEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => validateRemoveJsonGlobal(raw, ctx),
  });
  runScenarioStep(state, {
    name: "list-global-after-remove",
    args: ["list", "--global", "--agent-target", "claude", "--json"],
    cwd: ctx.globalWorkDir,
    env: globalEnv,
    strict,
    allowAuthBlocked,
    validate: validateListMissingWithTarget(ctx, "claude", "global"),
  });
  runScenarioStep(state, {
    name: "deprecate",
    args: [
      "deprecate",
      `${ctx.ownedSkillId}@${ctx.ownedVersion}`,
      "--message",
      "sweep-check",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  const deprecateStep = state.steps[state.steps.length - 1];
  runScenarioStep(state, {
    name: "use-deprecated-version",
    args: ["use", ctx.ownedSkillId, "--version", ctx.ownedVersion, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateDeprecatedUse,
    skipReason: deprecateStep.status === "pass" ? null : "deprecate step did not succeed",
  });
  runScenarioStep(state, {
    name: "unpublish",
    args: ["unpublish", `${ctx.ownedSkillId}@${ctx.ownedVersion}`, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  const unpublishStep = state.steps[state.steps.length - 1];
  runScenarioStep(state, {
    name: "history-after-unpublish",
    args: ["history", ctx.ownedSkillId, "--limit", "5", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    acceptedExitCodes: [0, 1],
    validate: validateHistoryEmpty,
    skipReason: unpublishStep.status === "pass" ? null : "unpublish step did not succeed",
  });
  runScenarioStep(state, {
    name: "remove",
    args: ["remove", ctx.ownedSkillId, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => validateRemoveJson(raw, ctx),
  });
  runScenarioStep(state, {
    name: "logout",
    args: ["logout"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "login-status-after-logout",
    args: ["login", "--status"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /(not logged in|no session)/i,
    kind: "expected_error",
  });

  return ctx;
}

function runExtendedTier({ state, env, strict, allowAuthBlocked }) {
  const isolatedHomeDir = join(state.workspace, "isolated-home-extended");
  mkdirSync(isolatedHomeDir, { recursive: true });
  const stepEnv = { ...env, HOME: isolatedHomeDir };
  const orgSlug = env.SKILLMD_E2E_ORG_SLUG;
  const orgMemberUsername =
    env.SKILLMD_E2E_ORG_MEMBER_USERNAME?.trim() || DEV_FIXTURE_DEFAULTS.proUsername;
  const orgSkillSlug = env.SKILLMD_E2E_ORG_SKILL_SLUG?.trim() || DEV_FIXTURE_DEFAULTS.orgSkillSlug;
  const teamSlug = `sweep-team-${RUN_ID}`;
  const teamName = `Sweep Team ${RUN_ID}`;

  runScenarioStep(state, {
    name: "extended-login",
    args: ["login", "--reauth"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /Login successful/i,
  });
  runScenarioStep(state, {
    name: "token-add",
    args: ["token", "add", `sweep-admin-${RUN_ID}`, "--scope", "admin", "--days", "1", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  let tokenId = null;
  const tokenAddStep = state.steps[state.steps.length - 1];
  if (tokenAddStep.status === "pass") {
    tokenId = parseJsonPayload(tokenAddStep.stdout)?.tokenId ?? null;
  }
  runScenarioStep(state, {
    name: "token-ls",
    args: ["token", "ls", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.tokens), "token ls invalid");
      assert(
        tokenId && payload.tokens.some((token) => token && token.tokenId === tokenId),
        "token missing from list",
      );
    },
  });
  runScenarioStep(state, {
    name: "token-rm",
    args: ["token", "rm", tokenId ?? "missing-token", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    skipReason: tokenId ? null : "token add did not return tokenId",
  });
  runScenarioStep(state, {
    name: "token-ls-after-rm",
    args: ["token", "ls", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    skipReason: tokenId ? null : "token add did not return tokenId",
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.tokens), "token ls invalid");
      const revokedToken = payload.tokens.find((token) => token && token.tokenId === tokenId);
      assert(
        !revokedToken || typeof revokedToken.revokedAt === "string",
        "token revoke did not persist revokedAt",
      );
    },
  });

  runScenarioStep(state, {
    name: "org-ls",
    args: ["org", "ls", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.organizations), "org ls invalid");
      assert(
        payload.organizations.some((org) => org && org.slug === orgSlug),
        `missing org ${orgSlug}`,
      );
    },
  });
  runScenarioStep(state, {
    name: "org-members-ls",
    args: ["org", "members", "ls", orgSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "org-members-add",
    args: ["org", "members", "add", orgSlug, orgMemberUsername, "--role", "member", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    acceptedExitCodes: [0, 1],
    validate: (raw) => {
      if (raw.exitCode === 0) {
        const payload = parseJsonPayload(raw.stdout);
        assert(payload && payload.username === orgMemberUsername, "org member add invalid");
        return;
      }
      assert(
        /already exists|version_conflict/i.test(raw.combined),
        "expected org member add to be idempotent when member already exists",
      );
    },
  });
  runScenarioStep(state, {
    name: "org-team-add",
    args: ["org", "team", "add", orgSlug, teamSlug, "--name", teamName, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "org-team-ls",
    args: ["org", "team", "ls", orgSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.teams), "org team ls invalid");
      assert(
        payload.teams.some((team) => team && team.teamSlug === teamSlug),
        `missing team ${teamSlug}`,
      );
    },
  });
  runScenarioStep(state, {
    name: "org-team-members-add",
    args: ["org", "team", "members", "add", orgSlug, teamSlug, orgMemberUsername, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "org-team-members-ls",
    args: ["org", "team", "members", "ls", orgSlug, teamSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(
        payload && payload.team && Array.isArray(payload.team.members),
        "org team members ls invalid",
      );
      assert(
        payload.team.members.some((member) => member && member.username === orgMemberUsername),
        `missing org team member ${orgMemberUsername}`,
      );
    },
  });
  runScenarioStep(state, {
    name: "org-skills-ls",
    args: ["org", "skills", "ls", orgSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.skills), "org skills ls invalid");
      assert(
        payload.skills.some((skill) => skill && skill.skill === orgSkillSlug),
        `missing org skill ${orgSkillSlug}`,
      );
    },
  });
  runScenarioStep(state, {
    name: "org-skills-team-set",
    args: ["org", "skills", "team", "set", orgSlug, orgSkillSlug, teamSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(
        payload && payload.skill && payload.skill.teamSlug === teamSlug,
        "org skill team set failed",
      );
    },
  });
  runScenarioStep(state, {
    name: "org-skills-team-clear",
    args: ["org", "skills", "team", "clear", orgSlug, orgSkillSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && payload.skill, "org skill team clear invalid");
      assert(
        payload.skill.teamSlug === null || payload.skill.teamSlug === undefined,
        "org skill team not cleared",
      );
    },
  });
  runScenarioStep(state, {
    name: "org-tokens-add",
    args: [
      "org",
      "tokens",
      "add",
      orgSlug,
      `sweep-org-${RUN_ID}`,
      "--scope",
      "admin",
      "--days",
      "1",
      "--json",
    ],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  let orgTokenId = null;
  const orgTokenAddStep = state.steps[state.steps.length - 1];
  if (orgTokenAddStep.status === "pass") {
    orgTokenId = parseJsonPayload(orgTokenAddStep.stdout)?.tokenId ?? null;
  }
  runScenarioStep(state, {
    name: "org-tokens-ls",
    args: ["org", "tokens", "ls", orgSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.tokens), "org tokens ls invalid");
      assert(
        orgTokenId && payload.tokens.some((token) => token && token.tokenId === orgTokenId),
        "org token missing from list",
      );
    },
  });
  runScenarioStep(state, {
    name: "org-tokens-rm",
    args: ["org", "tokens", "rm", orgSlug, orgTokenId ?? "missing-token", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    skipReason: orgTokenId ? null : "org token add did not return tokenId",
  });
  runScenarioStep(state, {
    name: "org-tokens-ls-after-rm",
    args: ["org", "tokens", "ls", orgSlug, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    skipReason: orgTokenId ? null : "org token add did not return tokenId",
    validate: (raw) => {
      const payload = parseJsonPayload(raw.stdout);
      assert(payload && Array.isArray(payload.tokens), "org tokens ls invalid");
      const revokedToken = payload.tokens.find((token) => token && token.tokenId === orgTokenId);
      assert(
        !revokedToken || typeof revokedToken.revokedAt === "string",
        "org token revoke did not persist revokedAt",
      );
    },
  });
  runScenarioStep(state, {
    name: "org-team-members-rm",
    args: ["org", "team", "members", "rm", orgSlug, teamSlug, orgMemberUsername, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "org-members-rm",
    args: ["org", "members", "rm", orgSlug, orgMemberUsername, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "extended-logout",
    args: ["logout"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
}

function runProfileSweep({
  profileName,
  strict,
  tier,
  allowAuthBlocked,
  workspaceOverride,
  keepWorkspace,
}) {
  const env = createProfileEnv(profileName);
  preflightOrThrow({ profileName, strict, tier, env });
  const workspace = setupWorkspace(profileName, workspaceOverride);
  const state = createSweepState({ profileName, strict, tier, workspace });

  console.log(
    `\n========== Running ${profileName.toUpperCase()} ${tier.toUpperCase()} sweep ==========`,
  );
  console.log(`Workspace: ${workspace}`);

  if (tier === "core" || tier === "all") {
    runCoreTier({ state, env, strict, allowAuthBlocked });
  }
  if (tier === "extended" || tier === "all") {
    runExtendedTier({ state, env, strict, allowAuthBlocked });
  }

  state.exitCode = summarizeOutcome(state);

  if (!workspaceOverride && !keepWorkspace) {
    rmSync(workspace, { recursive: true, force: true });
    state.workspaceDeleted = true;
  } else {
    state.workspaceDeleted = false;
  }

  console.log(
    `\n${profileName.toUpperCase()} summary: pass=${state.counts.pass} fail=${state.counts.fail} blocked=${state.counts.blocked} skipped=${state.counts.skipped}`,
  );

  return state;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`command-sweep: ${error instanceof Error ? error.message : "invalid arguments"}`);
    printUsageAndExit(1);
    return;
  }

  const targets = options.env === "both" ? ["dev", "prod"] : [options.env];
  const results = [];
  let finalExitCode = 0;

  for (const target of targets) {
    try {
      const sweep = runProfileSweep({
        profileName: target,
        strict: options.strict,
        tier: options.tier,
        allowAuthBlocked: options.allowAuthBlocked && !options.strict,
        workspaceOverride: options.workspace,
        keepWorkspace: options.keepWorkspace,
      });
      results.push(sweep);
      finalExitCode = Math.max(finalExitCode, sweep.exitCode);
    } catch (error) {
      console.error(`command-sweep: ${error instanceof Error ? error.message : "sweep failed"}`);
      finalExitCode = Math.max(finalExitCode, 1);
      results.push({
        profile: target,
        strict: options.strict,
        tier: options.tier,
        workspace: options.workspace ?? null,
        counts: { pass: 0, fail: 1, blocked: 0, skipped: 0 },
        steps: [],
        exitCode: 1,
        workspaceDeleted: false,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cliPath: CLI_PATH,
    options: {
      env: options.env,
      strict: options.strict,
      tier: options.tier,
      keepWorkspace: options.keepWorkspace,
      workspace: options.workspace,
    },
    results,
    commandCoverage: buildCommandCoverage(results),
    summary: {
      pass: results.reduce((sum, item) => sum + item.counts.pass, 0),
      fail: results.reduce((sum, item) => sum + item.counts.fail, 0),
      blocked: results.reduce((sum, item) => sum + item.counts.blocked, 0),
      skipped: results.reduce((sum, item) => sum + item.counts.skipped, 0),
      exitCode: finalExitCode,
    },
  };

  if (options.reportFile) {
    mkdirSync(dirname(options.reportFile), { recursive: true });
    writeFileSync(options.reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\nReport written to ${options.reportFile}`);
  }

  console.log("\nFinal summary:");
  console.log(JSON.stringify(report.summary, null, 2));
  process.exit(finalExitCode);
}

main();
