#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const reportPath = join(repoRoot, "determinism-report.json");

function runCli(args, options = {}) {
  const output = execFileSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output.trim();
}

function parsePublishJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`publish output was not valid JSON: ${raw}`);
  }
}

function assertDryRunPayload(payload, runName) {
  if (!payload || typeof payload !== "object") {
    throw new Error(`${runName}: publish payload was not an object`);
  }
  if (payload.status !== "dry-run") {
    throw new Error(`${runName}: expected status 'dry-run', got '${payload.status}'`);
  }
  if (typeof payload.digest !== "string" || !payload.digest.startsWith("sha256:")) {
    throw new Error(`${runName}: missing/invalid digest`);
  }
  if (typeof payload.sizeBytes !== "number" || payload.sizeBytes <= 0) {
    throw new Error(`${runName}: missing/invalid sizeBytes`);
  }
}

function buildIsolatedEnv(homeDir) {
  return {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
  };
}

function main() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "skillmd-determinism-"));
  const homeDir = join(tmpRoot, "home");
  const skillDir = join(tmpRoot, "determinism-skill");

  mkdirSync(join(homeDir, ".skillmd"), { recursive: true });
  mkdirSync(skillDir, { recursive: true });

  writeFileSync(
    join(homeDir, ".skillmd", "auth.json"),
    `${JSON.stringify(
      {
        provider: "github",
        uid: "determinism-user",
        githubUsername: "determinism-user",
        refreshToken: "dry-run-token",
        projectId: "skillmarkdown",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const env = buildIsolatedEnv(homeDir);

  try {
    runCli(["init", "--template", "verbose", "--no-validate"], { cwd: skillDir, env });
    runCli(["validate", "--strict"], { cwd: skillDir, env });

    const run1 = parsePublishJson(
      runCli(["publish", skillDir, "--version", "1.0.0", "--dry-run", "--json"], { env }),
    );
    assertDryRunPayload(run1, "run1");

    const run2 = parsePublishJson(
      runCli(["publish", skillDir, "--version", "1.0.0", "--dry-run", "--json"], { env }),
    );
    assertDryRunPayload(run2, "run2");

    mkdirSync(join(skillDir, ".agent"), { recursive: true });
    writeFileSync(join(skillDir, ".agent", "local.txt"), "ignored local cache\n", "utf8");

    const run3 = parsePublishJson(
      runCli(["publish", skillDir, "--version", "1.0.0", "--dry-run", "--json"], { env }),
    );
    assertDryRunPayload(run3, "run3");

    writeFileSync(
      join(skillDir, "SKILL.md"),
      `${readFileSync(join(skillDir, "SKILL.md"), "utf8")}\n`,
    );

    const run4 = parsePublishJson(
      runCli(["publish", skillDir, "--version", "1.0.0", "--dry-run", "--json"], { env }),
    );
    assertDryRunPayload(run4, "run4");

    const checks = {
      repeatStable: run1.digest === run2.digest && run1.sizeBytes === run2.sizeBytes,
      ignoredChangeStable: run2.digest === run3.digest && run2.sizeBytes === run3.sizeBytes,
      includedChangeMutates: run3.digest !== run4.digest,
    };

    if (!checks.repeatStable || !checks.ignoredChangeStable || !checks.includedChangeMutates) {
      throw new Error(
        `determinism checks failed: ${JSON.stringify({ checks, run1, run2, run3, run4 }, null, 2)}`,
      );
    }

    const report = {
      os: process.platform,
      nodeVersion: process.version,
      checks,
      baseline: {
        digest: run1.digest,
        sizeBytes: run1.sizeBytes,
      },
      runs: {
        run1: { digest: run1.digest, sizeBytes: run1.sizeBytes },
        run2: { digest: run2.digest, sizeBytes: run2.sizeBytes },
        run3: { digest: run3.digest, sizeBytes: run3.sizeBytes },
        run4: { digest: run4.digest, sizeBytes: run4.sizeBytes },
      },
    };

    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Wrote determinism report to ${reportPath}`);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
