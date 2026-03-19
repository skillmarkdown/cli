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
const providerTargets = [
  "skillmd",
  "openai",
  "claude",
  "gemini",
  "meta",
  "mistral",
  "deepseek",
  "perplexity",
];
const backendBuiltinTargets = new Set(["skillmd", "claude", "gemini"]);

function resolvePublishTarget(target) {
  return backendBuiltinTargets.has(target) ? target : `custom:${target}`;
}

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
    version: "1.0.0",
    access: "public",
    prefix: "",
    keepWorkspace: false,
    workspace: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") {
      parsed.version = argv[index + 1] ?? parsed.version;
      index += 1;
      continue;
    }
    if (arg.startsWith("--version=")) {
      parsed.version = arg.slice("--version=".length);
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
    if (arg === "--prefix") {
      parsed.prefix = (argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--prefix=")) {
      parsed.prefix = arg.slice("--prefix=".length).trim();
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

  return parsed;
}

function printUsage(code) {
  console.log(
    [
      "Usage: node scripts/publish-provider-batch.mjs [options]",
      "",
      "Options:",
      "  --version <semver>      Version to publish for every provider. Default: 1.0.0",
      "  --access <public|private>  Publish access. Default: public",
      "  --prefix <text>         Optional slug prefix, e.g. dev-",
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

function slugForTarget(target, prefix) {
  const normalizedPrefix = prefix ? `${prefix.replace(/-+$/u, "")}-` : "";
  return `${normalizedPrefix}${target}-skill-publisher`;
}

function enrichProviderSkill(skillDir, target, index) {
  const skillFile = join(skillDir, "SKILL.md");
  const original = readFileSync(skillFile, "utf8");
  const licenseLine =
    index % 2 === 0 ? 'license: "MIT (see LICENSE)"' : 'license: "Proprietary reference content"';
  const enriched = original
    .replace(
      "description: Explain what this skill does and when an agent should use it.",
      `description: Publish and maintain ${target} skills with registry-safe versioning, release hygiene, and provider-specific packaging notes.`,
    )
    .replace(
      '# metadata:\n#   author: "your-org"\n#   version: "1.0.0"',
      `metadata:\n  author: "Skillmarkdown"\n  provider: "${target}"\n  category: "publisher"\n  maturity: "reference"`,
    )
    .replace(
      "license: Optional. Add a license name or reference to a bundled license file.",
      licenseLine,
    )
    .replace(
      "## When to use\n\nDescribe the signals or request patterns that should trigger this skill. Keep SKILL.md focused and move deep details into references/ files.",
      `## When to use\n\nUse this skill when an operator needs to prepare, validate, or publish ${target} skills to the registry, especially during onboarding, provider seeding, or release rehearsals.`,
    );

  writeFileSync(skillFile, enriched, "utf8");
  writeFileSync(
    join(skillDir, "references", "PROVIDER-NOTES.md"),
    [
      `# ${target} Provider Notes`,
      "",
      `This seed skill exists to represent the ${target} agent target in development and release walkthroughs.`,
      "",
      "Recommended checks:",
      "- validate before every publish",
      "- keep release tags aligned with dist-tags",
      "- verify install/use behavior after publication",
      "",
    ].join("\n"),
    "utf8",
  );

  if (index % 2 === 0) {
    writeFileSync(join(skillDir, "LICENSE"), mitLicense, "utf8");
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tempRoot = options.workspace ?? mkdtempSync(join(tmpdir(), "skillmd-provider-batch-"));
  const keepWorkspace = options.keepWorkspace || Boolean(options.workspace);

  try {
    console.log(`Workspace: ${tempRoot}`);
    const published = [];

    providerTargets.forEach((target, index) => {
      const slug = slugForTarget(target, options.prefix);
      const skillDir = join(tempRoot, slug);
      mkdirSync(skillDir, { recursive: true });
      runCli(["init", "--template", "verbose", "--no-validate"], skillDir);
      enrichProviderSkill(skillDir, target, index);
      runCli(["validate", skillDir, "--strict"], repoRoot);
      const publishTarget = resolvePublishTarget(target);
      const raw = runCli(
        [
          "publish",
          skillDir,
          "--version",
          options.version,
          "--access",
          options.access,
          "--agent-target",
          publishTarget,
          "--json",
        ],
        repoRoot,
      );
      const parsed = JSON.parse(raw);
      published.push({
        agentTarget: target,
        skillId: parsed.skillId,
        version: parsed.version,
        status: parsed.status,
        publishTarget,
        includesLicense: index % 2 === 0,
      });
      console.log(
        `Published ${parsed.skillId}@${parsed.version} for ${target} via ${publishTarget}`,
      );
    });

    console.log(JSON.stringify({ workspace: tempRoot, published }, null, 2));
  } finally {
    if (!keepWorkspace) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main();
