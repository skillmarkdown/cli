#!/usr/bin/env node

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadInternalScriptEnv } from "./internal-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const scriptEnv = loadInternalScriptEnv();

function parseArgs(argv) {
  const parsed = {
    count: 25,
    prefix: "cursorseed-private",
    version: "1.0.0",
    keepWorkspace: false,
    workspace: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--count") {
      parsed.count = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    if (arg.startsWith("--count=")) {
      parsed.count = Number.parseInt(arg.slice("--count=".length), 10);
      continue;
    }
    if (arg === "--prefix") {
      parsed.prefix = argv[index + 1] ?? parsed.prefix;
      index += 1;
      continue;
    }
    if (arg.startsWith("--prefix=")) {
      parsed.prefix = arg.slice("--prefix=".length);
      continue;
    }
    if (arg === "--version") {
      parsed.version = argv[index + 1] ?? parsed.version;
      index += 1;
      continue;
    }
    if (arg.startsWith("--version=")) {
      parsed.version = arg.slice("--version=".length);
      continue;
    }
    if (arg === "--workspace") {
      parsed.workspace = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--workspace=")) {
      parsed.workspace = resolve(arg.slice("--workspace=".length));
      continue;
    }
    if (arg === "--keep-workspace") {
      parsed.keepWorkspace = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage(0);
    }
    throw new Error(`unsupported argument: ${arg}`);
  }

  if (!Number.isInteger(parsed.count) || parsed.count < 1) {
    throw new Error("--count must be a positive integer");
  }

  if (!parsed.prefix.trim()) {
    throw new Error("--prefix must be non-empty");
  }

  return parsed;
}

function printUsage(code) {
  console.log(
    [
      "Usage: node scripts/publish-private-search-seed.mjs [options]",
      "",
      "Publishes a repeatable batch of private skills for cursor/pagination verification.",
      "Loads dev credentials from process.env or ~/.skillmd/.env.",
      "Requires non-interactive CLI login env vars:",
      "  SKILLMD_LOGIN_EMAIL",
      "  SKILLMD_LOGIN_PASSWORD",
      "",
      "Options:",
      "  --count <n>             Number of private skills to publish. Default: 25",
      "  --prefix <slug-prefix>  Skill slug prefix. Default: cursorseed-private",
      "  --version <semver>      Version to publish. Default: 1.0.0",
      "  --workspace <path>      Reuse a fixed workspace path",
      "  --keep-workspace        Keep generated workspace after completion",
      "  --help                  Show this help",
    ].join("\n"),
  );
  process.exit(code);
}

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    env: scriptEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`skillmd ${args.join(" ")} failed\n${output}`);
  }

  return (result.stdout ?? "").trim();
}

function ensureLogin() {
  if (!scriptEnv.SKILLMD_LOGIN_EMAIL?.trim() || !scriptEnv.SKILLMD_LOGIN_PASSWORD?.trim()) {
    throw new Error(
      "seed requires SKILLMD_LOGIN_EMAIL and SKILLMD_LOGIN_PASSWORD in process.env or ~/.skillmd/.env",
    );
  }

  runCli(["login", "--reauth"], repoRoot);
}

function slugAt(prefix, index, width) {
  return `${prefix}-${String(index).padStart(width, "0")}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tempRoot = options.workspace ?? mkdtempSync(join(tmpdir(), "skillmd-seed-private-search-"));
  const keepWorkspace = options.keepWorkspace || Boolean(options.workspace);
  const width = Math.max(2, String(options.count).length);

  try {
    ensureLogin();
    console.log(`Workspace: ${tempRoot}`);

    const published = [];
    for (let index = 1; index <= options.count; index += 1) {
      const slug = slugAt(options.prefix, index, width);
      const skillDir = join(tempRoot, slug);
      mkdirSync(skillDir, { recursive: true });
      runCli(["init", "--template", "verbose"], skillDir);
      const raw = runCli(
        [
          "publish",
          skillDir,
          "--version",
          options.version,
          "--tag",
          "latest",
          "--access",
          "private",
          "--agent-target",
          "skillmd",
          "--json",
        ],
        repoRoot,
      );
      const payload = JSON.parse(raw);
      published.push({
        skillId: payload.skillId,
        version: payload.version,
        status: payload.status,
      });
      console.log(`Published ${payload.skillId} version ${payload.version} (${payload.status})`);
    }

    console.log(
      JSON.stringify({ workspace: tempRoot, prefix: options.prefix, published }, null, 2),
    );
  } finally {
    if (!keepWorkspace) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main();
