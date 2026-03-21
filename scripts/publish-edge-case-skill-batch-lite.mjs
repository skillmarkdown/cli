#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = resolve(repoRoot, "scripts", "publish-edge-case-skill-batch.mjs");

const forwardedArgs = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [
    scriptPath,
    "--profile",
    "baseline",
    "--count",
    "10",
    "--skip-discover-coverage",
    ...forwardedArgs,
  ],
  {
    stdio: "inherit",
    cwd: repoRoot,
    env: process.env,
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
