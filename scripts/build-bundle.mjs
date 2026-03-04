#!/usr/bin/env node

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(repoRoot, "dist", "cli.js");
const debugBuild = process.argv.includes("--debug");
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
if (typeof packageJson.version !== "string" || packageJson.version.trim().length === 0) {
  throw new Error("Invalid package version in package.json");
}

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
  minify: !debugBuild,
  sourcemap: false,
  define: {
    __SKILLMD_CLI_VERSION__: JSON.stringify(packageJson.version),
  },
  logLevel: "info",
});
