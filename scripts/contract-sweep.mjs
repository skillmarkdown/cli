#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(ROOT_DIR, "dist", "cli.js");
const WORKSPACE = mkdtempSync(join(tmpdir(), "skillmd-contract-"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCli(args, { cwd = ROOT_DIR, env = {} } = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: WORKSPACE,
      ...env,
    },
  });
}

function createIsolatedHome() {
  return mkdtempSync(join(WORKSPACE, "home-"));
}

function writeSkillsManifest(cwd, payload) {
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, "skills.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const failures = [];

  const scenarios = [
    () => {
      const result = runCli([]);
      assert(result.status === 1, "root no-command should fail");
      assert(/no command provided/i.test(result.stderr), "missing no-command error");
    },
    () => {
      const result = runCli(["bogus"]);
      assert(result.status === 1, "unknown command should fail");
      assert(/unknown command/i.test(result.stderr), "missing unknown-command error");
    },
    () => {
      const result = runCli([
        "--auth-token",
        "skmd_dev_tok_abc123abc123abc123abc123.secret",
        "--version",
      ]);
      assert(result.status === 0, "root --version with auth token should pass");
      assert(/\d+\.\d+\.\d+/.test(result.stdout.trim()), "expected version output");
    },
    () => {
      const skillDir = join(WORKSPACE, "validate-parity");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: parity-check\n---\n\n# parity-check\n",
        "utf8",
      );
      const result = runCli(["validate", skillDir, "--parity"]);
      assert(result.status === 0 || result.status === 1, "validate --parity should exit cleanly");
      assert(
        /Validation parity/i.test(`${result.stdout}\n${result.stderr}`),
        "missing parity output",
      );
    },
    () => {
      const result = spawnSync(
        process.execPath,
        [
          "--test",
          "tests/integration/cli-integration.test.js",
          "tests/contracts/command-matrix.test.js",
        ],
        {
          cwd: ROOT_DIR,
          encoding: "utf8",
          env: process.env,
        },
      );
      assert(result.status === 0, "spawned integration contract suite should pass");
    },
    () => {
      const workDir = join(WORKSPACE, "use-save");
      writeSkillsManifest(workDir, {
        version: 1,
        defaults: { agentTarget: "skillmd" },
        dependencies: {},
      });
      const result = runCli(["use", "@core/agent", "--save"], { cwd: workDir });
      assert(result.status === 1, "use --save without registry fixture should fail after parsing");
      assert(!/unsupported argument/i.test(result.stderr), "use --save should parse");
    },
    () => {
      const result = runCli(["use", "@core/agent", "--save", "--global"]);
      assert(result.status === 1, "use --save --global should fail");
      assert(
        /--save cannot be combined with --global/i.test(result.stderr),
        "missing save/global conflict",
      );
    },
    () => {
      const result = runCli(["token", "rm", "bad"]);
      assert(result.status === 1, "token invalid id should fail");
      assert(/Usage: skillmd token/i.test(result.stderr), "missing token usage output");
    },
    () => {
      const result = runCli(["org", "tokens", "add", "facebook", "ci", "--scope", "read"]);
      assert(result.status === 1, "org token read scope should fail usage");
      assert(
        /Usage: skillmd org/i.test(result.stderr),
        "missing org usage output for org token invalid scope",
      );
    },
    () => {
      const result = runCli(["login"], {
        env: {
          HOME: createIsolatedHome(),
          SKILLMD_LOGIN_EMAIL: "fixture@example.com",
        },
      });
      assert(result.status === 1, "login with partial env should fail");
      assert(
        /requires both SKILLMD_LOGIN_EMAIL and SKILLMD_LOGIN_PASSWORD/i.test(result.stderr),
        "missing login env error",
      );
    },
    () => {
      const workDir = join(WORKSPACE, "list-global");
      mkdirSync(workDir, { recursive: true });
      const result = runCli(["list", "--global", "--json"], { cwd: workDir });
      assert(result.status === 0, "list --global should succeed locally");
      const payload = JSON.parse(result.stdout);
      assert(Array.isArray(payload.entries), "list --global payload invalid");
    },
    () => {
      const workDir = join(WORKSPACE, "remove-global");
      mkdirSync(workDir, { recursive: true });
      const result = runCli(["remove", "@core/agent", "--global", "--json"], { cwd: workDir });
      assert(result.status === 1, "remove --global should fail for missing install");
      assert(!/Usage: skillmd remove/i.test(result.stderr), "remove --global should parse cleanly");
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    try {
      await scenario();
      console.log(`[PASS] contract-${index + 1}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ index: index + 1, message });
      console.error(`[FAIL] contract-${index + 1}: ${message}`);
    }
  }

  rmSync(WORKSPACE, { recursive: true, force: true });

  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("contract sweep completed successfully");
}

await main();
