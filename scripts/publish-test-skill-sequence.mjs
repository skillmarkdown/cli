#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadInternalScriptEnv } from "./internal-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const scriptEnv = loadInternalScriptEnv();
const defaultVersions = ["0.1.0", "0.1.1", "0.2.0", "1.0.0"];
const mitLicense = `MIT License

Copyright (c) 2026 Skillmarkdown

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function parseArgs(argv) {
  const parsed = {
    versions: defaultVersions,
    keepWorkspace: false,
    workspace: null,
    access: "public",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep-workspace") {
      parsed.keepWorkspace = true;
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
    if (arg === "--versions") {
      parsed.versions = argv[index + 1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (arg.startsWith("--versions=")) {
      parsed.versions = arg
        .slice("--versions=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === "--access") {
      parsed.access = argv[index + 1] ?? parsed.access;
      index += 1;
      continue;
    }
    if (arg.startsWith("--access=")) {
      parsed.access = arg.slice("--access=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage(0);
    }
    throw new Error(`unsupported argument: ${arg}`);
  }

  if (parsed.versions.length === 0) {
    throw new Error("at least one version is required");
  }

  return parsed;
}

function printUsage(code) {
  console.log(
    [
      "Usage: node scripts/publish-test-skill-sequence.mjs [options]",
      "",
      "Options:",
      "  --versions <csv>        Versions to publish. Default: 0.1.0,0.1.1,0.2.0,1.0.0",
      "  --access <public|private>  Publish access. Default: public",
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

function enrichTestSkill(skillDir) {
  const skillFile = join(skillDir, "SKILL.md");
  const original = readFileSync(skillFile, "utf8");
  const enriched = original
    .replace(
      "description: Explain what this skill does and when an agent should use it.",
      "description: Publish and version a realistic reference skill used for registry smoke checks and local release walkthroughs.",
    )
    .replace(
      '# metadata:\n#   author: "your-org"\n#   version: "1.0.0"',
      'metadata:\n  author: "Skillmarkdown"\n  category: "release-ops"\n  maturity: "reference"',
    )
    .replace(
      "license: Optional. Add a license name or reference to a bundled license file.",
      'license: "MIT (see LICENSE)"',
    );

  writeFileSync(skillFile, enriched, "utf8");
  writeFileSync(join(skillDir, "LICENSE"), mitLicense, "utf8");
  writeFileSync(
    join(skillDir, "references", "PUBLISHING.md"),
    [
      "# Publishing Notes",
      "",
      "This reference skill is used to exercise:",
      "- initial publish",
      "- repeated version releases",
      "- history inspection",
      "- deterministic package integrity",
      "",
      "The content is intentionally verbose so the resulting tarball looks like a realistic package.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tempRoot = options.workspace ?? mkdtempSync(join(tmpdir(), "skillmd-seed-test-"));
  const keepWorkspace = options.keepWorkspace || Boolean(options.workspace);
  const skillDir = join(tempRoot, "test-skill");

  try {
    console.log(`Workspace: ${tempRoot}`);
    mkdirSync(skillDir, { recursive: true });
    runCli(["init", "--template", "verbose", "--no-validate"], skillDir);
    enrichTestSkill(skillDir);
    runCli(["validate", skillDir, "--strict"], repoRoot);

    const published = [];
    for (const version of options.versions) {
      const raw = runCli(
        ["publish", skillDir, "--version", version, "--access", options.access, "--json"],
        repoRoot,
      );
      const parsed = JSON.parse(raw);
      published.push({ version: parsed.version, status: parsed.status, skillId: parsed.skillId });
      console.log(`Published ${parsed.skillId} version ${parsed.version} (${parsed.status})`);
    }

    console.log(JSON.stringify({ workspace: tempRoot, published }, null, 2));
  } finally {
    if (!keepWorkspace) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main();
