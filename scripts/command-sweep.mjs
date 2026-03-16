#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { pickFirstNonEmpty, sanitizeStepForOutput } from "./command-sweep-utils.mjs";

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
    ...process.env,
    SKILLMD_FIREBASE_PROJECT_ID: profile.firebaseProjectId,
    SKILLMD_REGISTRY_BASE_URL: profile.registryBaseUrl,
  };

  if (profileName === "dev") {
    const devKey = pickFirstNonEmpty(
      process.env.SKILLMD_DEV_FIREBASE_API_KEY,
      process.env.SKILLMD_FIREBASE_API_KEY,
    );
    if (devKey) {
      env.SKILLMD_FIREBASE_API_KEY = devKey;
    }
  } else {
    const prodKey = pickFirstNonEmpty(
      process.env.SKILLMD_PROD_FIREBASE_API_KEY,
      PROD_DEFAULT_API_KEY,
    );
    env.SKILLMD_FIREBASE_API_KEY = prodKey;
  }

  return env;
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

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

  let status = "fail";
  if (kind === "expected_error") {
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
    strict: config.strict,
    allowAuthBlocked: config.allowAuthBlocked,
    required: config.required ?? true,
    skipReason: config.skipReason ?? null,
    validate: config.validate,
  });

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
  ];
  const missingCore = requiredCoreEnv.filter((key) => !env[key]?.trim());
  if (missingCore.length > 0) {
    throw new Error(`missing strict core prerequisites: ${missingCore.join(", ")}`);
  }

  if (tier === "extended" || tier === "all") {
    const requiredExtendedEnv = [
      "SKILLMD_E2E_ORG_SLUG",
      "SKILLMD_E2E_ORG_MEMBER_USERNAME",
      "SKILLMD_E2E_ORG_SKILL_SLUG",
    ];
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
  const initDir = join(workspace, "init-verbose");
  const publishDir = join(workspace, `publish-skill-${RUN_ID}`);
  const workDir = join(workspace, "work");
  mkdirSync(isolatedHomeDir, { recursive: true });
  mkdirSync(initDir, { recursive: true });
  mkdirSync(publishDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  return {
    isolatedHomeDir,
    initDir,
    publishDir,
    workDir,
    ownedSkillId: null,
    ownedVersion: "1.0.0",
    installedPath: null,
    manifestInstallPath: null,
  };
}

function validateWhoami(raw) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && typeof payload.owner === "string", "whoami did not return owner");
  assert(typeof payload.username === "string", "whoami did not return username");
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

function validateSearchEmpty(raw) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.results), "search did not return results");
  assert(payload.results.length === 0, "expected empty search results");
}

function validateView(ctx) {
  return (raw) => {
    const payload = parseJsonPayload(raw.stdout);
    const [owner, skill] = ctx.ownedSkillId.split("/");
    assert(payload && payload.owner === owner, "view owner mismatch");
    assert(payload.skill === skill, "view skill mismatch");
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

function validateRemoveJson(raw, ctx) {
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && typeof payload.removed === "number", "remove did not report removed count");
  if (ctx.installedPath) {
    assert(!existsSync(ctx.installedPath), "removed install path still exists");
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
  const payload = parseJsonPayload(raw.stdout);
  assert(payload && Array.isArray(payload.results), "history did not return results");
  assert(payload.results.length === 0, "expected empty history results");
}

function runCoreTier({ state, env, strict, allowAuthBlocked }) {
  const ctx = makeCoreContext(state.workspace);
  const stepEnv = { ...env, HOME: ctx.isolatedHomeDir };

  runScenarioStep(state, {
    name: "root-version",
    args: ["--version"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "root-version-short",
    args: ["-v"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
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
  });
  runScenarioStep(state, {
    name: "login-status",
    args: ["login", "--status"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    expectedPattern: /(logged in|project:)/i,
  });
  runScenarioStep(state, {
    name: "whoami",
    args: ["whoami", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateWhoami,
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
  });

  if (!ctx.ownedSkillId) {
    return ctx;
  }

  const ownedSkillSlug = ctx.ownedSkillId.split("/")[1];

  runScenarioStep(state, {
    name: "search-owned-skill",
    args: ["search", ownedSkillSlug, "--json"],
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
    validate: validateTagList("qa-sweep", false),
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
    name: "update-skill",
    args: ["update", ctx.ownedSkillId, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateUpdateJson,
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
  runScenarioStep(state, {
    name: "use-deprecated-version",
    args: ["use", ctx.ownedSkillId, "--version", ctx.ownedVersion, "--json"],
    cwd: ctx.workDir,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateDeprecatedUse,
  });
  runScenarioStep(state, {
    name: "unpublish",
    args: ["unpublish", `${ctx.ownedSkillId}@${ctx.ownedVersion}`, "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
  });
  runScenarioStep(state, {
    name: "history-after-unpublish",
    args: ["history", ctx.ownedSkillId, "--limit", "5", "--json"],
    cwd: ROOT_DIR,
    env: stepEnv,
    strict,
    allowAuthBlocked,
    validate: validateHistoryEmpty,
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
  });

  return ctx;
}

function runExtendedTier({ state, env, strict, allowAuthBlocked }) {
  const isolatedHomeDir = join(state.workspace, "isolated-home-extended");
  mkdirSync(isolatedHomeDir, { recursive: true });
  const stepEnv = { ...env, HOME: isolatedHomeDir };
  const orgSlug = env.SKILLMD_E2E_ORG_SLUG;
  const orgMemberUsername = env.SKILLMD_E2E_ORG_MEMBER_USERNAME;
  const orgSkillSlug = env.SKILLMD_E2E_ORG_SKILL_SLUG;
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
      assert(
        !payload.tokens.some((token) => token && token.tokenId === tokenId),
        "token still present after revoke",
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
      assert(
        !payload.tokens.some((token) => token && token.tokenId === orgTokenId),
        "org token still present after revoke",
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
