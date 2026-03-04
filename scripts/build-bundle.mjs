#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(repoRoot, "dist", "cli.js");

mkdirSync(dirname(outFile), { recursive: true });

await build({
  entryPoints: [resolve(repoRoot, "src", "cli.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: ["node18"],
  external: ["tar", "yaml", "semver"],
  legalComments: "none",
  minify: false,
  sourcemap: false,
  logLevel: "info",
});
