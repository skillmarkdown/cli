#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

// Public web API key used by packaged/global CLI default auth config.
const PROD_DEFAULT_API_KEY = "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok";

const AUTH_BLOCK_PATTERNS = [
  /PROJECT_NUMBER_MISMATCH/i,
  /invalid bearer token/i,
  /unauthorized/i,
  /session project '.*' does not match current config/i,
  /not logged in/i,
  /refresh token is revoked/i,
  /missing authentication token/i,
  /secure token exchange failed/i,
];

function parseArgs(argv) {
  const parsed = {
    env: "dev",
    write: false,
    extended: false,
    allowAuthBlocked: false,
    keepWorkspace: false,
    reportFile: null,
    workspace: null,
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

  return parsed;
}

function printUsageAndExit(code) {
  const message = [
    "Usage: node scripts/command-sweep.mjs [options]",
    "",
    "Options:",
    "  --env <dev|prod|both>     Target environment profile(s). Default: dev",
    "  --write                   Include write-path commands (publish real, tag add/rm, deprecate, unpublish)",
    "  --extended                Include additional edge-case scenarios (recommended with --write)",
    "  --allow-auth-blocked      Do not fail process on auth-blocked write steps",
    "  --workspace <path>        Reuse a fixed workspace path (default: new temp dir)",
    "  --keep-workspace          Keep temp workspace after run",
    "  --report-file <path>      Write JSON report to file",
    "  --help                    Show this help",
  ].join("\n");

  console.log(message);
  process.exit(code);
}

function isAuthBlocked(output) {
  return AUTH_BLOCK_PATTERNS.some((pattern) => pattern.test(output));
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

function printStep(result, state) {
  const safeResult = sanitizeStepForOutput(result);
  const statusLabel = safeResult.status.toUpperCase();
  const command = `skillmd ${safeResult.args.join(" ")}`;
  console.log(`\n[${statusLabel}] ${result.name}`);
  console.log(`  cwd: ${safeResult.cwd}`);
  console.log(`  cmd: ${command}`);
  console.log(`  exit: ${safeResult.exitCode} (${safeResult.durationMs}ms)`);

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

function runStep({ state, name, args, cwd, env, skipReason = null }) {
  if (skipReason) {
    const skipped = {
      name,
      args,
      cwd,
      exitCode: -1,
      stdout: "",
      stderr: skipReason,
      combined: skipReason,
      durationMs: 0,
      status: "skipped",
    };
    printStep(skipped, state);
    return skipped;
  }

  const raw = runCli({ env, cwd, args });
  const status = raw.exitCode === 0 ? "pass" : isAuthBlocked(raw.combined) ? "blocked" : "fail";
  const finalized = { ...raw, name, status };
  printStep(finalized, state);
  return finalized;
}

function runExpectedErrorStep({ state, name, args, cwd, env, expectedPattern, skipReason = null }) {
  if (skipReason) {
    const skipped = {
      name,
      args,
      cwd,
      exitCode: -1,
      stdout: "",
      stderr: skipReason,
      combined: skipReason,
      durationMs: 0,
      status: "skipped",
    };
    printStep(skipped, state);
    return skipped;
  }

  const raw = runCli({ env, cwd, args });
  const matchedExpectedPattern = expectedPattern ? expectedPattern.test(raw.combined) : true;
  const expectedFailureMatched = raw.exitCode !== 0 && matchedExpectedPattern;
  const status = expectedFailureMatched ? "pass" : isAuthBlocked(raw.combined) ? "blocked" : "fail";
  const finalized = { ...raw, name, status };
  printStep(finalized, state);
  return finalized;
}

function runExpectedSuccessStep({
  state,
  name,
  args,
  cwd,
  env,
  expectedPattern,
  skipReason = null,
}) {
  if (skipReason) {
    const skipped = {
      name,
      args,
      cwd,
      exitCode: -1,
      stdout: "",
      stderr: skipReason,
      combined: skipReason,
      durationMs: 0,
      status: "skipped",
    };
    printStep(skipped, state);
    return skipped;
  }

  const raw = runCli({ env, cwd, args });
  const matchedExpectedPattern = expectedPattern ? expectedPattern.test(raw.combined) : true;
  const expectedSuccessMatched = raw.exitCode === 0 && matchedExpectedPattern;
  const status = expectedSuccessMatched ? "pass" : isAuthBlocked(raw.combined) ? "blocked" : "fail";
  const finalized = { ...raw, name, status };
  printStep(finalized, state);
  return finalized;
}

function parseSearchResult(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results)) {
    return null;
  }

  const withLatest = payload.results.find(
    (item) => item && typeof item === "object" && item.skillId && item.distTags?.latest,
  );
  if (withLatest) {
    return {
      skillId: withLatest.skillId,
      latestVersion: withLatest.distTags.latest,
    };
  }

  const first = payload.results.find(
    (item) => item && typeof item === "object" && typeof item.skillId === "string",
  );
  if (!first) {
    return null;
  }

  return {
    skillId: first.skillId,
    latestVersion: null,
  };
}

function parseJsonPayload(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function parseTokenCreateResult(stdout) {
  const payload = parseJsonPayload(stdout);
  if (!payload || typeof payload !== "object") {
    return { tokenId: null, token: null };
  }

  return {
    tokenId: typeof payload.tokenId === "string" ? payload.tokenId : null,
    token: typeof payload.token === "string" ? payload.token : null,
  };
}

function summarizeOutcome(state, allowAuthBlocked) {
  const hasFail = state.counts.fail > 0;
  const hasBlocked = state.counts.blocked > 0;
  if (hasFail) {
    return 2;
  }
  if (hasBlocked && !allowAuthBlocked) {
    return 3;
  }
  return 0;
}

function runProfileSweep({
  profileName,
  writeEnabled,
  extendedEnabled,
  allowAuthBlocked,
  workspaceOverride,
  keepWorkspace,
}) {
  const env = createProfileEnv(profileName);
  const workspace = workspaceOverride
    ? resolve(workspaceOverride, `skillmd-sweep-${profileName}`)
    : mkdtempSync(join(tmpdir(), `skillmd-sweep-${profileName}-`));
  mkdirSync(workspace, { recursive: true });

  const state = {
    profile: profileName,
    writeEnabled,
    extendedEnabled,
    workspace,
    counts: {
      pass: 0,
      fail: 0,
      blocked: 0,
      skipped: 0,
    },
    steps: [],
  };

  console.log(`\n========== Running ${profileName.toUpperCase()} sweep ==========`);
  console.log(`Workspace: ${workspace}`);

  const readSkill = {
    skillId: null,
    latestVersion: null,
  };

  const initDir = join(workspace, "init-verbose");
  const publishDir = join(workspace, `publish-skill-${Date.now()}`);
  const fallbackDir = join(workspace, `fallback-skill-${Date.now()}`);
  const workDir = join(workspace, "work");
  const edgeDir = join(workspace, "edge-cases");
  const isolatedHomeDir = join(workspace, "isolated-home");
  mkdirSync(initDir, { recursive: true });
  mkdirSync(publishDir, { recursive: true });
  mkdirSync(fallbackDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(edgeDir, { recursive: true });
  mkdirSync(isolatedHomeDir, { recursive: true });

  runStep({ state, name: "login-status", args: ["login", "--status"], cwd: ROOT_DIR, env });
  runStep({ state, name: "root-version", args: ["--version"], cwd: ROOT_DIR, env });
  runStep({ state, name: "root-version-short", args: ["-v"], cwd: ROOT_DIR, env });
  runStep({ state, name: "whoami", args: ["whoami", "--json"], cwd: ROOT_DIR, env });
  runStep({ state, name: "token-ls", args: ["token", "ls", "--json"], cwd: ROOT_DIR, env });

  runStep({
    state,
    name: "init-verbose",
    args: ["init", "--template", "verbose"],
    cwd: initDir,
    env,
  });
  runStep({
    state,
    name: "validate-strict",
    args: ["validate", initDir, "--strict"],
    cwd: ROOT_DIR,
    env,
  });

  runStep({
    state,
    name: "init-publish",
    args: ["init", "--template", "verbose"],
    cwd: publishDir,
    env,
  });

  const dryRun = runStep({
    state,
    name: "publish-dry-run",
    args: [
      "publish",
      publishDir,
      "--version",
      "1.0.0",
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
    env,
  });

  const searchStep = runStep({
    state,
    name: "search",
    args: ["search", "--json"],
    cwd: ROOT_DIR,
    env,
  });
  if (searchStep.status === "pass") {
    const parsed = parseSearchResult(searchStep.stdout);
    if (parsed) {
      readSkill.skillId = parsed.skillId;
      readSkill.latestVersion = parsed.latestVersion;
    }
  }

  if (writeEnabled && !readSkill.skillId) {
    const seedReadStep = runStep({
      state,
      name: "seed-read-skill",
      args: [
        "publish",
        publishDir,
        "--version",
        "1.0.0",
        "--tag",
        "latest",
        "--access",
        "public",
        "--agent-target",
        "skillmd",
        "--json",
      ],
      cwd: ROOT_DIR,
      env,
    });

    if (seedReadStep.status === "pass") {
      try {
        const payload = JSON.parse(seedReadStep.stdout);
        if (payload && typeof payload.skillId === "string" && typeof payload.version === "string") {
          readSkill.skillId = payload.skillId;
          readSkill.latestVersion = payload.version;
        }
      } catch {
        // ignore parse failure; follow existing missing-read-skill behavior
      }
    }
  }

  const missingReadSkillReason = !readSkill.skillId
    ? "unable to pick a read skill from search results"
    : null;
  const missingUseSkillReason = !readSkill.skillId
    ? "unable to pick a read skill from search results"
    : !readSkill.latestVersion
      ? "no distTags.latest found for selected skill; skipping use-version/update-by-id checks"
      : null;

  runStep({
    state,
    name: "view-skill",
    args: readSkill.skillId ? ["view", readSkill.skillId, "--json"] : ["view"],
    cwd: ROOT_DIR,
    env,
    skipReason: missingReadSkillReason,
  });

  runStep({
    state,
    name: "history-skill",
    args: readSkill.skillId
      ? ["history", readSkill.skillId, "--limit", "5", "--json"]
      : ["history"],
    cwd: ROOT_DIR,
    env,
    skipReason: missingReadSkillReason,
  });

  runStep({
    state,
    name: "tag-ls",
    args: readSkill.skillId ? ["tag", "ls", readSkill.skillId, "--json"] : ["tag", "ls"],
    cwd: ROOT_DIR,
    env,
    skipReason: missingReadSkillReason,
  });

  if (readSkill.skillId && readSkill.latestVersion) {
    writeFileSync(
      join(workDir, "skills.json"),
      `${JSON.stringify(
        {
          version: 1,
          defaults: {
            agentTarget: "skillmd",
          },
          dependencies: {
            [readSkill.skillId]: {
              spec: "latest",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  runStep({
    state,
    name: "install-workspace",
    args: readSkill.skillId && readSkill.latestVersion ? ["install", "--json"] : ["install"],
    cwd: workDir,
    env,
    skipReason: missingUseSkillReason,
  });

  const useDefaultStep = runStep({
    state,
    name: "use-default",
    args:
      readSkill.skillId && readSkill.latestVersion ? ["use", readSkill.skillId, "--json"] : ["use"],
    cwd: workDir,
    env,
    skipReason: missingUseSkillReason,
  });

  runStep({
    state,
    name: "use-spec-latest",
    args: readSkill.skillId ? ["use", readSkill.skillId, "--spec", "latest", "--json"] : ["use"],
    cwd: workDir,
    env,
    skipReason: missingUseSkillReason,
  });

  runStep({
    state,
    name: "use-version",
    args:
      readSkill.skillId && readSkill.latestVersion
        ? ["use", readSkill.skillId, "--version", readSkill.latestVersion, "--json"]
        : ["use"],
    cwd: workDir,
    env,
    skipReason: missingUseSkillReason,
  });

  runStep({
    state,
    name: "update-skill",
    args:
      readSkill.skillId && readSkill.latestVersion
        ? ["update", readSkill.skillId, "--json"]
        : ["update"],
    cwd: workDir,
    env,
    skipReason:
      missingUseSkillReason ||
      (useDefaultStep.status !== "pass"
        ? "use-default did not complete successfully; skipping update-by-id"
        : null),
  });

  runStep({
    state,
    name: "update-all",
    args: ["update", "--all", "--json"],
    cwd: workDir,
    env,
  });

  runStep({
    state,
    name: "logout-isolated",
    args: ["logout"],
    cwd: ROOT_DIR,
    env: { ...env, HOME: isolatedHomeDir },
  });

  runExpectedErrorStep({
    state,
    name: "edge-install-missing-skills-json",
    args: ["install"],
    cwd: edgeDir,
    env,
    expectedPattern: /skills\.json not found in current directory/i,
  });

  runExpectedErrorStep({
    state,
    name: "edge-use-invalid-version",
    args: ["use", "@stefdevscore/example", "--version", "1.0"],
    cwd: ROOT_DIR,
    env,
    expectedPattern: /Usage: skillmd use/i,
  });

  runExpectedErrorStep({
    state,
    name: "edge-publish-invalid-access",
    args: ["publish", publishDir, "--version", "1.0.0", "--access", "shared"],
    cwd: ROOT_DIR,
    env,
    expectedPattern: /Usage: skillmd publish/i,
  });

  runExpectedErrorStep({
    state,
    name: "edge-tag-add-semver-tag-rejected",
    args: ["tag", "add", "@stefdevscore/example@1.0.0", "1.2.3"],
    cwd: ROOT_DIR,
    env,
    expectedPattern: /Usage: skillmd tag/i,
  });

  runExpectedErrorStep({
    state,
    name: "edge-token-add-invalid-days",
    args: ["token", "add", "edge-bad-days", "--days", "0"],
    cwd: ROOT_DIR,
    env,
    expectedPattern: /Usage: skillmd token/i,
  });

  let ownedSkillId = null;
  const ownedVersion = "1.0.0";
  const notFoundPattern = /(not_found|status 404|not found)/i;
  const scopeDeniedPattern = /(forbidden|unauthorized|status (401|403))/i;
  const unpublishDenySpec = pickFirstNonEmpty(env.SKILLMD_SWEEP_UNPUBLISH_DENY_SPEC);
  let fallbackSkillId = null;

  if (writeEnabled) {
    const publishRealStep = runStep({
      state,
      name: "publish-real",
      args: [
        "publish",
        publishDir,
        "--version",
        ownedVersion,
        "--tag",
        "latest",
        "--access",
        "public",
        "--agent-target",
        "skillmd",
        "--json",
      ],
      cwd: ROOT_DIR,
      env,
    });

    if (publishRealStep.status === "pass") {
      try {
        const payload = JSON.parse(publishRealStep.stdout);
        if (payload && typeof payload.skillId === "string") {
          ownedSkillId = payload.skillId;
        }
      } catch {
        ownedSkillId = null;
      }
    }

    const prereqBlockedReason =
      publishRealStep.status === "blocked" ? "publish-real blocked by auth" : null;
    const prereqFailedReason =
      !prereqBlockedReason && (!ownedSkillId || publishRealStep.status !== "pass")
        ? "publish-real failed; skipping write follow-up commands"
        : null;
    const writeSkipReason = prereqBlockedReason ?? prereqFailedReason;

    if (extendedEnabled) {
      runExpectedSuccessStep({
        state,
        name: "extended-publish-idempotent",
        args: [
          "publish",
          publishDir,
          "--version",
          ownedVersion,
          "--tag",
          "latest",
          "--access",
          "public",
          "--agent-target",
          "skillmd",
          "--json",
        ],
        cwd: ROOT_DIR,
        env,
        expectedPattern: /"status"\s*:\s*"idempotent"/i,
        skipReason: writeSkipReason,
      });

      if (!writeSkipReason) {
        writeFileSync(join(publishDir, "SKILL.md"), "\n<!-- sweep-conflict-check -->\n", {
          encoding: "utf8",
          flag: "a",
        });
      }

      runExpectedErrorStep({
        state,
        name: "extended-publish-version-conflict",
        args: [
          "publish",
          publishDir,
          "--version",
          ownedVersion,
          "--tag",
          "latest",
          "--access",
          "public",
          "--agent-target",
          "skillmd",
          "--json",
        ],
        cwd: ROOT_DIR,
        env,
        expectedPattern: /(version conflict|version_conflict|status 409)/i,
        skipReason: writeSkipReason,
      });

      runStep({
        state,
        name: "extended-init-fallback-no-latest",
        args: ["init", "--template", "verbose"],
        cwd: fallbackDir,
        env,
        skipReason: writeSkipReason,
      });

      const publishFallbackStep = runStep({
        state,
        name: "extended-publish-fallback-no-latest",
        args: [
          "publish",
          fallbackDir,
          "--version",
          "1.0.0",
          "--tag",
          "beta",
          "--access",
          "public",
          "--agent-target",
          "skillmd",
          "--json",
        ],
        cwd: ROOT_DIR,
        env,
        skipReason: writeSkipReason,
      });

      if (publishFallbackStep.status === "pass") {
        const payload = parseJsonPayload(publishFallbackStep.stdout);
        if (payload && typeof payload.skillId === "string") {
          fallbackSkillId = payload.skillId;
        }
      }

      runExpectedSuccessStep({
        state,
        name: "extended-use-fallback-no-latest",
        args: fallbackSkillId ? ["use", fallbackSkillId, "--json"] : ["use"],
        cwd: workDir,
        env,
        expectedPattern: /"version"\s*:\s*"1\.0\.0"/i,
        skipReason:
          writeSkipReason ||
          (publishFallbackStep.status !== "pass"
            ? "fallback publish failed; skipping latest-fallback use test"
            : !fallbackSkillId
              ? "fallback publish did not return skillId"
              : null),
      });
    }

    runStep({
      state,
      name: "tag-add",
      args: ownedSkillId
        ? ["tag", "add", `${ownedSkillId}@${ownedVersion}`, "qa-sweep", "--json"]
        : ["tag", "add"],
      cwd: ROOT_DIR,
      env,
      skipReason: writeSkipReason,
    });

    runStep({
      state,
      name: "tag-rm",
      args: ownedSkillId ? ["tag", "rm", ownedSkillId, "qa-sweep", "--json"] : ["tag", "rm"],
      cwd: ROOT_DIR,
      env,
      skipReason: writeSkipReason,
    });

    if (extendedEnabled) {
      runExpectedSuccessStep({
        state,
        name: "extended-tag-rm-missing",
        args: ownedSkillId
          ? ["tag", "rm", ownedSkillId, "missing-tag-sweep", "--json"]
          : ["tag", "rm"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: /"status"\s*:\s*"deleted"/i,
        skipReason: writeSkipReason,
      });

      runExpectedErrorStep({
        state,
        name: "extended-tag-add-missing-version",
        args: ownedSkillId
          ? ["tag", "add", `${ownedSkillId}@9.9.9`, "missing-version", "--json"]
          : ["tag", "add"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: notFoundPattern,
        skipReason: writeSkipReason,
      });

      const readTokenStep = runStep({
        state,
        name: "extended-token-read-add",
        args: ["token", "add", "sweep-read", "--scope", "read", "--days", "1", "--json"],
        cwd: ROOT_DIR,
        env,
        skipReason: writeSkipReason,
      });

      const { tokenId: readTokenId, token: readToken } = parseTokenCreateResult(
        readTokenStep.stdout,
      );

      runStep({
        state,
        name: "extended-token-read-search",
        args: readToken ? ["search", "--json", "--auth-token", readToken] : ["search", "--json"],
        cwd: ROOT_DIR,
        env,
        skipReason:
          writeSkipReason ||
          (readTokenStep.status !== "pass"
            ? "read token was not created"
            : !readToken
              ? "read token add did not return token secret"
              : null),
      });

      runExpectedErrorStep({
        state,
        name: "extended-token-read-deny-tag-add",
        args:
          readToken && ownedSkillId
            ? [
                "tag",
                "add",
                `${ownedSkillId}@${ownedVersion}`,
                "read-deny",
                "--json",
                "--auth-token",
                readToken,
              ]
            : ["tag", "add"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: scopeDeniedPattern,
        skipReason:
          writeSkipReason ||
          (readTokenStep.status !== "pass"
            ? "read token was not created"
            : !readToken
              ? "read token add did not return token secret"
              : !ownedSkillId
                ? "owned skill id missing"
                : null),
      });

      runStep({
        state,
        name: "extended-token-read-rm",
        args: readTokenId ? ["token", "rm", readTokenId, "--json"] : ["token", "rm"],
        cwd: ROOT_DIR,
        env,
        skipReason:
          writeSkipReason ||
          (readTokenStep.status !== "pass"
            ? "read token was not created"
            : !readTokenId
              ? "read token add did not return tokenId"
              : null),
      });

      const publishTokenStep = runStep({
        state,
        name: "extended-token-publish-add",
        args: ["token", "add", "sweep-publish", "--scope", "publish", "--days", "1", "--json"],
        cwd: ROOT_DIR,
        env,
        skipReason: writeSkipReason,
      });

      const { tokenId: publishTokenId, token: publishToken } = parseTokenCreateResult(
        publishTokenStep.stdout,
      );

      runStep({
        state,
        name: "extended-token-publish-tag-add",
        args:
          publishToken && ownedSkillId
            ? [
                "tag",
                "add",
                `${ownedSkillId}@${ownedVersion}`,
                "publish-token",
                "--json",
                "--auth-token",
                publishToken,
              ]
            : ["tag", "add"],
        cwd: ROOT_DIR,
        env,
        skipReason:
          writeSkipReason ||
          (publishTokenStep.status !== "pass"
            ? "publish token was not created"
            : !publishToken
              ? "publish token add did not return token secret"
              : !ownedSkillId
                ? "owned skill id missing"
                : null),
      });

      runStep({
        state,
        name: "extended-token-publish-tag-rm",
        args:
          publishToken && ownedSkillId
            ? ["tag", "rm", ownedSkillId, "publish-token", "--json", "--auth-token", publishToken]
            : ["tag", "rm"],
        cwd: ROOT_DIR,
        env,
        skipReason:
          writeSkipReason ||
          (publishTokenStep.status !== "pass"
            ? "publish token was not created"
            : !publishToken
              ? "publish token add did not return token secret"
              : !ownedSkillId
                ? "owned skill id missing"
                : null),
      });

      runExpectedErrorStep({
        state,
        name: "extended-token-publish-deny-deprecate",
        args:
          publishToken && ownedSkillId
            ? [
                "deprecate",
                `${ownedSkillId}@${ownedVersion}`,
                "--message",
                "publish-scope-deny",
                "--json",
                "--auth-token",
                publishToken,
              ]
            : ["deprecate"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: scopeDeniedPattern,
        skipReason:
          writeSkipReason ||
          (publishTokenStep.status !== "pass"
            ? "publish token was not created"
            : !publishToken
              ? "publish token add did not return token secret"
              : !ownedSkillId
                ? "owned skill id missing"
                : null),
      });

      runStep({
        state,
        name: "extended-token-publish-rm",
        args: publishTokenId ? ["token", "rm", publishTokenId, "--json"] : ["token", "rm"],
        cwd: ROOT_DIR,
        env,
        skipReason:
          writeSkipReason ||
          (publishTokenStep.status !== "pass"
            ? "publish token was not created"
            : !publishTokenId
              ? "publish token add did not return tokenId"
              : null),
      });

      const adminTokenStep = runStep({
        state,
        name: "extended-token-admin-add",
        args: ["token", "add", "sweep-admin", "--scope", "admin", "--days", "1", "--json"],
        cwd: ROOT_DIR,
        env,
        skipReason: writeSkipReason,
      });

      const { tokenId: adminTokenId, token: adminToken } = parseTokenCreateResult(
        adminTokenStep.stdout,
      );

      runExpectedSuccessStep({
        state,
        name: "extended-token-admin-whoami",
        args: adminToken ? ["whoami", "--json", "--auth-token", adminToken] : ["whoami", "--json"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: /"scope"\s*:\s*"admin"/i,
        skipReason:
          writeSkipReason ||
          (adminTokenStep.status !== "pass"
            ? "admin token was not created"
            : !adminToken
              ? "admin token add did not return token secret"
              : null),
      });

      runStep({
        state,
        name: "extended-token-admin-rm",
        args: adminTokenId ? ["token", "rm", adminTokenId, "--json"] : ["token", "rm"],
        cwd: ROOT_DIR,
        env,
        skipReason:
          writeSkipReason ||
          (adminTokenStep.status !== "pass"
            ? "admin token was not created"
            : !adminTokenId
              ? "admin token add did not return tokenId"
              : null),
      });
    }

    const deprecateStep = runStep({
      state,
      name: "deprecate",
      args: ownedSkillId
        ? ["deprecate", `${ownedSkillId}@${ownedVersion}`, "--message", "sweep-check", "--json"]
        : ["deprecate"],
      cwd: ROOT_DIR,
      env,
      skipReason: writeSkipReason,
    });

    if (extendedEnabled) {
      runExpectedSuccessStep({
        state,
        name: "extended-use-deprecated-warning",
        args:
          ownedSkillId && ownedVersion
            ? ["use", ownedSkillId, "--version", ownedVersion, "--json"]
            : ["use"],
        cwd: workDir,
        env,
        expectedPattern: /"warnings"\s*:\s*\[\s*".*deprecated/i,
        skipReason:
          writeSkipReason ||
          (deprecateStep.status !== "pass"
            ? "deprecate failed; skipping deprecated warning check"
            : null),
      });
    }

    const unpublishStep = runStep({
      state,
      name: "unpublish",
      args: ownedSkillId
        ? ["unpublish", `${ownedSkillId}@${ownedVersion}`, "--json"]
        : ["unpublish"],
      cwd: ROOT_DIR,
      env,
      skipReason: writeSkipReason,
    });

    if (extendedEnabled) {
      runExpectedErrorStep({
        state,
        name: "extended-use-unpublished-version",
        args:
          ownedSkillId && ownedVersion
            ? ["use", ownedSkillId, "--version", ownedVersion, "--json"]
            : ["use"],
        cwd: workDir,
        env,
        expectedPattern: notFoundPattern,
        skipReason:
          writeSkipReason ||
          (unpublishStep.status !== "pass"
            ? "unpublish failed; skipping unpublished-version checks"
            : null),
      });

      runExpectedErrorStep({
        state,
        name: "extended-tag-add-unpublished-version",
        args:
          ownedSkillId && ownedVersion
            ? ["tag", "add", `${ownedSkillId}@${ownedVersion}`, "after-unpublish", "--json"]
            : ["tag", "add"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: notFoundPattern,
        skipReason:
          writeSkipReason ||
          (unpublishStep.status !== "pass"
            ? "unpublish failed; skipping unpublished-version checks"
            : null),
      });

      runExpectedSuccessStep({
        state,
        name: "extended-history-excludes-unpublished",
        args: ownedSkillId ? ["history", ownedSkillId, "--limit", "5", "--json"] : ["history"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: /"results"\s*:\s*\[\s*\]/i,
        skipReason:
          writeSkipReason ||
          (unpublishStep.status !== "pass"
            ? "unpublish failed; skipping unpublished-version checks"
            : null),
      });

      runExpectedErrorStep({
        state,
        name: "extended-unpublish-window-denied",
        args: unpublishDenySpec ? ["unpublish", unpublishDenySpec, "--json"] : ["unpublish"],
        cwd: ROOT_DIR,
        env,
        expectedPattern: /(unpublish_denied|status 409)/i,
        skipReason: !unpublishDenySpec
          ? "set SKILLMD_SWEEP_UNPUBLISH_DENY_SPEC='@username/skill@version' to enable this policy-window check"
          : writeSkipReason,
      });
    }

    const tokenCreateStep = runStep({
      state,
      name: "token-add",
      args: ["token", "add", "sweep-token", "--scope", "admin", "--days", "7", "--json"],
      cwd: ROOT_DIR,
      env,
      skipReason: prereqBlockedReason,
    });

    let createdTokenId = null;
    if (tokenCreateStep.status === "pass") {
      createdTokenId = parseTokenCreateResult(tokenCreateStep.stdout).tokenId;
    }

    runStep({
      state,
      name: "token-rm",
      args: createdTokenId ? ["token", "rm", createdTokenId, "--json"] : ["token", "rm"],
      cwd: ROOT_DIR,
      env,
      skipReason:
        prereqBlockedReason ||
        (tokenCreateStep.status !== "pass"
          ? "token-add failed; skipping token-rm"
          : !createdTokenId
            ? "token-add did not return tokenId"
            : null),
    });
  }

  state.exitCode = summarizeOutcome(state, allowAuthBlocked);
  state.meta = {
    readSkill,
    ownedSkillId,
    fallbackSkillId,
    dryRunStatus: dryRun.status,
  };

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
    const message = error instanceof Error ? error.message : "invalid arguments";
    console.error(`command-sweep: ${message}`);
    printUsageAndExit(1);
    return;
  }

  const targets = options.env === "both" ? ["dev", "prod"] : [options.env];

  const results = [];
  let finalExitCode = 0;

  for (const target of targets) {
    const writeEnabled = options.write;
    const sweep = runProfileSweep({
      profileName: target,
      writeEnabled,
      extendedEnabled: options.extended,
      allowAuthBlocked: options.allowAuthBlocked,
      workspaceOverride: options.workspace,
      keepWorkspace: options.keepWorkspace,
    });

    results.push(sweep);
    finalExitCode = Math.max(finalExitCode, sweep.exitCode);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cliPath: CLI_PATH,
    options: {
      env: options.env,
      write: options.write,
      extended: options.extended,
      allowAuthBlocked: options.allowAuthBlocked,
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
