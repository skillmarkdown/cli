#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(repoRoot, "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const templateRoot = resolve(workspaceRoot, "skillmd-cli-skill");
const defaultCount = 240;
const defaultVersionSet = [
  "0.1.0",
  "0.1.1",
  "0.2.0",
  "1.0.0",
  "1.1.0-beta.1",
  "2.0.0-rc.1",
  "3.0.0",
];
const defaultTags = ["latest", "beta", "rc", "canary", "stable"];
const defaultTargets = [
  "skillmd",
  "openai",
  "claude",
  "gemini",
  "meta",
  "mistral",
  "deepseek",
  "perplexity",
];
const licenseTexts = {
  MIT: `MIT License

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
`,
  Apache2: `Apache License\nVersion 2.0, January 2004\nhttps://www.apache.org/licenses/LICENSE-2.0\n`,
  Proprietary: `Copyright (c) 2026 Skillmarkdown. Internal reference content only. Redistribution requires approval.\n`,
};

function parseArgs(argv) {
  const parsed = {
    count: defaultCount,
    startIndex: 1,
    access: "public",
    workspace: null,
    keepWorkspace: false,
    prefix: "edge",
    versionsPerSkill: 1,
    versionSet: [...defaultVersionSet],
    tags: [...defaultTags],
    targets: [...defaultTargets],
    dryRun: false,
    verbose: false,
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
    if (arg === "--start-index") {
      parsed.startIndex = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    if (arg.startsWith("--start-index=")) {
      parsed.startIndex = Number.parseInt(arg.slice("--start-index=".length), 10);
      continue;
    }
    if (arg === "--versions-per-skill") {
      parsed.versionsPerSkill = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    if (arg.startsWith("--versions-per-skill=")) {
      parsed.versionsPerSkill = Number.parseInt(arg.slice("--versions-per-skill=".length), 10);
      continue;
    }
    if (arg === "--access") {
      parsed.access = (argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--access=")) {
      parsed.access = arg.slice("--access=".length).trim();
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
    if (arg === "--targets") {
      parsed.targets = splitCsv(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--targets=")) {
      parsed.targets = splitCsv(arg.slice("--targets=".length));
      continue;
    }
    if (arg === "--tags") {
      parsed.tags = splitCsv(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--tags=")) {
      parsed.tags = splitCsv(arg.slice("--tags=".length));
      continue;
    }
    if (arg === "--version-set") {
      parsed.versionSet = splitCsv(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--version-set=")) {
      parsed.versionSet = splitCsv(arg.slice("--version-set=".length));
      continue;
    }
    if (arg === "--keep-workspace") {
      parsed.keepWorkspace = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--verbose") {
      parsed.verbose = true;
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
  if (!Number.isInteger(parsed.startIndex) || parsed.startIndex < 1) {
    throw new Error("--start-index must be a positive integer");
  }
  if (!Number.isInteger(parsed.versionsPerSkill) || parsed.versionsPerSkill < 1) {
    throw new Error("--versions-per-skill must be a positive integer");
  }
  if (!["public", "private"].includes(parsed.access)) {
    throw new Error("--access must be public or private");
  }
  if (parsed.targets.length === 0) {
    throw new Error("--targets must include at least one agent target");
  }
  if (parsed.versionSet.length === 0) {
    throw new Error("--version-set must include at least one semver value");
  }
  if (parsed.tags.length === 0) {
    throw new Error("--tags must include at least one dist-tag value");
  }

  return parsed;
}

function splitCsv(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function printUsage(code) {
  console.log(
    [
      "Usage: node scripts/publish-edge-case-skill-batch.mjs [options]",
      "",
      "Create and publish hundreds of realistic skills derived from the workspace",
      "skillmd-cli-skill template, varying content completeness and publish parameters",
      "for browse/search/detail/install edge-case handling.",
      "",
      "Options:",
      `  --count <n>               Number of skills to generate. Default: ${defaultCount}`,
      "  --start-index <n>         Starting sequence number. Default: 1",
      "  --versions-per-skill <n>  Versions to publish per skill. Default: 1",
      "  --access <public|private> Publish access. Default: public",
      "  --targets <csv>           Agent targets. Default: built-in provider set",
      "  --tags <csv>              Dist-tags to rotate across publishes",
      "  --version-set <csv>       Semver set to rotate across publishes",
      "  --prefix <text>           Skill slug prefix. Default: edge",
      "  --workspace <path>        Reuse a fixed workspace path",
      "  --keep-workspace          Keep generated workspace after completion",
      "  --dry-run                 Validate and dry-run publish instead of live publish",
      "  --verbose                 Print every publish command before running",
      "  --help                    Show this help",
      "",
      "Examples:",
      "  node scripts/publish-edge-case-skill-batch.mjs",
      "  node scripts/publish-edge-case-skill-batch.mjs --count 320 --versions-per-skill 2",
      "  node scripts/publish-edge-case-skill-batch.mjs --prefix edgeb --dry-run",
      "  node scripts/publish-edge-case-skill-batch.mjs --targets skillmd,claude,gemini --count 90",
      "",
      "Notes:",
      "  - private publish requires a Pro-capable account",
      "  - uses /skillmd-cli-skill as the source template for wholeness",
      "  - writes a summary manifest to edge-case-publish-report.json in the workspace",
    ].join("\n"),
  );
  process.exit(code);
}

function runCli(args, cwd, verbose) {
  if (verbose) {
    console.log(`$ skillmd ${args.join(" ")}`);
  }

  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`skillmd ${args.join(" ")} failed\n${output}`);
  }

  return (result.stdout ?? "").trim();
}

function ensureTemplateExists() {
  if (!existsSync(templateRoot)) {
    throw new Error(`template root not found: ${templateRoot}`);
  }
}

function padNumber(value) {
  return String(value).padStart(4, "0");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
}

function copyTemplateSkill(destination) {
  const gitDir = join(templateRoot, ".git");
  cpSync(templateRoot, destination, {
    recursive: true,
    filter(source) {
      return source !== gitDir && !source.startsWith(`${gitDir}/`);
    },
  });
  rmSync(join(destination, ".git"), { recursive: true, force: true });
}

function replaceAll(text, searchValue, replacement) {
  return text.split(searchValue).join(replacement);
}

function buildScenario(index, options) {
  const target = options.targets[index % options.targets.length];
  const contentMode = ["full", "lean", "reference-heavy", "ops-heavy"][index % 4];
  const licenseMode = ["MIT", "Apache2", "Proprietary", "none"][index % 4];
  const historyLength = Math.max(1, Math.min(options.versionsPerSkill, options.versionSet.length));
  const publishes = [];

  for (let versionIndex = 0; versionIndex < historyLength; versionIndex += 1) {
    const version = options.versionSet[(index + versionIndex) % options.versionSet.length];
    const tag = pickTag(version, options.tags[(index + versionIndex) % options.tags.length]);
    publishes.push({ version, tag });
  }

  const descriptor = [
    target,
    contentMode,
    licenseMode === "none" ? "nolicense" : slugify(licenseMode),
    index % 2 === 0 ? "assets" : "docs",
    index % 3 === 0 ? "unicode" : "plain",
  ].join("-");

  const skillSlug = `${slugify(options.prefix)}-${padNumber(options.startIndex + index)}-${descriptor}`;
  return {
    index,
    target,
    contentMode,
    licenseMode,
    includeSecurityPolicy: index % 3 !== 1,
    includeContributingGuide: index % 3 !== 2,
    includeExtraAsset: index % 2 === 0,
    includeWorkflowNotes: index % 2 === 1,
    includeUnicodeNotes: index % 3 === 0,
    includeLongMetadata: index % 5 === 0,
    includeExamplesAppendix: index % 4 === 0,
    publishes,
    skillSlug,
  };
}

function pickTag(version, fallbackTag) {
  if (version.includes("-beta.")) return "beta";
  if (version.includes("-rc.")) return "rc";
  return fallbackTag;
}

function rewriteTemplateFiles(skillDir, scenario) {
  const skillFile = join(skillDir, "SKILL.md");
  const readmeFile = join(skillDir, "README.md");
  const packageJsonFile = join(skillDir, "package.json");
  const referenceFile = join(skillDir, "references", "REFERENCE.md");
  const contributingFile = join(skillDir, "CONTRIBUTING.md");
  const securityFile = join(skillDir, "SECURITY.md");
  const assetsReadmeFile = join(skillDir, "assets", "README.md");
  const extraReferenceFile = join(skillDir, "references", "EDGE-CASES.md");
  const workflowNotesFile = join(skillDir, "references", "WORKFLOW-NOTES.md");
  const assetDataFile = join(skillDir, "assets", "matrix-notes.json");
  const licenseFile = join(skillDir, "LICENSE");

  const handle = `@test/${scenario.skillSlug}`;
  const title = `${scenario.target.toUpperCase()} Registry Coverage Skill`;
  const shortDescription = `Exercise ${scenario.target} registry behavior with realistic content and varied release parameters.`;
  const longDescription = `${shortDescription} This package is generated from the skillmd-cli-skill template and expanded to cover browse, detail, install, and lifecycle edge cases.`;

  let skillContent = readFileSync(skillFile, "utf8");
  skillContent = replaceAll(skillContent, "name: skillmd-cli-skill", `name: ${scenario.skillSlug}`);
  skillContent = replaceAll(
    skillContent,
    "description: Use @skillmarkdown/cli to scaffold, validate, publish, discover, install, and operate full v1 skill lifecycle workflows with deterministic command sequences.",
    `description: ${longDescription}`,
  );
  skillContent = replaceAll(
    skillContent,
    '  version: "1.1.2"',
    `  version: "${scenario.publishes[scenario.publishes.length - 1].version}"`,
  );
  skillContent = replaceAll(skillContent, "license: MIT", buildLicenseLine(scenario.licenseMode));
  skillContent = replaceAll(
    skillContent,
    "This skill covers end-to-end usage of `@skillmarkdown/cli` for v1 lifecycle operations:",
    `This generated skill covers end-to-end usage of \`@skillmarkdown/cli\` for ${scenario.target} lifecycle operations and intentionally exercises edge-case rendering, package metadata, and release permutations:`,
  );
  skillContent = skillContent.replace(
    /## Examples[\s\S]*?## Limitations \/ Failure modes/u,
    `${buildExamplesSection(scenario)}\n\n## Limitations / Failure modes`,
  );
  if (scenario.includeLongMetadata) {
    skillContent = skillContent.replace(
      'metadata:\n  author: "skillmarkdown"\n  version: "1.1.2"',
      [
        "metadata:",
        '  author: "skillmarkdown"',
        `  version: "${scenario.publishes[scenario.publishes.length - 1].version}"`,
        `  agentTarget: "${scenario.target}"`,
        `  contentMode: "${scenario.contentMode}"`,
        `  packageHandle: "${handle}"`,
        '  coverage: "edge-case-registry-seed"',
      ].join("\n"),
    );
  }
  if (scenario.includeUnicodeNotes) {
    skillContent +=
      "\n\n## Localization notes\n\nThis generated package includes unicode text such as café, naïve, and 東京 to verify registry rendering and search token stability.\n";
  }
  writeFileSync(skillFile, skillContent, "utf8");

  let readmeContent = readFileSync(readmeFile, "utf8");
  readmeContent = replaceAll(readmeContent, "# skillmd-cli-skill", `# ${scenario.skillSlug}`);
  readmeContent = replaceAll(
    readmeContent,
    "Skill for using `@skillmarkdown/cli` with current v1 command contracts across authoring, discovery, auth, release operations, and consumption workflows.",
    `${title}. ${longDescription}`,
  );
  readmeContent = replaceAll(readmeContent, "@owner/skillmd-cli-skill", handle);
  readmeContent = replaceAll(readmeContent, "@skillmarkdown/skillmd-cli-skill", handle);
  readmeContent += `\n\n## Generated scenario\n\n- Agent target: \`${scenario.target}\`\n- Content mode: \`${scenario.contentMode}\`\n- License mode: \`${scenario.licenseMode}\`\n- Publish sequence: ${scenario.publishes.map(({ version, tag }) => `\`${version}\` (tag \`${tag}\`)`).join(", ")}\n`;
  writeFileSync(readmeFile, readmeContent, "utf8");

  const pkg = JSON.parse(readFileSync(packageJsonFile, "utf8"));
  pkg.name = `@test/${scenario.skillSlug}`;
  pkg.description = longDescription;
  pkg.version = scenario.publishes[scenario.publishes.length - 1].version;
  pkg.license =
    scenario.licenseMode === "none"
      ? "UNLICENSED"
      : scenario.licenseMode === "Apache2"
        ? "Apache-2.0"
        : scenario.licenseMode;
  writeFileSync(packageJsonFile, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  let referenceContent = readFileSync(referenceFile, "utf8");
  referenceContent = replaceAll(referenceContent, "skillmd-cli-skill", scenario.skillSlug);
  referenceContent += `\n\n## Edge-case matrix\n\n- Skill handle: ${handle}\n- Agent target: ${scenario.target}\n- Releases: ${scenario.publishes.map(({ version }) => version).join(", ")}\n- Dist-tags: ${scenario.publishes.map(({ tag }) => tag).join(", ")}\n`;
  writeFileSync(referenceFile, referenceContent, "utf8");

  writeFileSync(
    extraReferenceFile,
    [
      `# ${scenario.skillSlug} Edge Cases`,
      "",
      `This package is designed to pressure-test registry rendering and sorting for ${scenario.target}.`,
      "",
      "Coverage notes:",
      `- content mode: ${scenario.contentMode}`,
      `- license mode: ${scenario.licenseMode}`,
      `- includes unicode: ${scenario.includeUnicodeNotes ? "yes" : "no"}`,
      `- includes extra assets: ${scenario.includeExtraAsset ? "yes" : "no"}`,
      `- includes examples appendix: ${scenario.includeExamplesAppendix ? "yes" : "no"}`,
    ].join("\n"),
    "utf8",
  );

  writeFileSync(
    assetsReadmeFile,
    [
      `# Assets for ${scenario.skillSlug}`,
      "",
      "This asset directory intentionally carries realistic but lightweight support material so the package does not look skeletal in registry detail views.",
    ].join("\n"),
    "utf8",
  );

  if (scenario.includeExtraAsset) {
    writeFileSync(
      assetDataFile,
      `${JSON.stringify(
        {
          skillId: handle,
          target: scenario.target,
          contentMode: scenario.contentMode,
          versions: scenario.publishes,
          tags: scenario.publishes.map(({ tag }) => tag),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } else {
    rmSync(assetDataFile, { force: true });
  }

  if (scenario.includeWorkflowNotes) {
    writeFileSync(
      workflowNotesFile,
      [
        "# Workflow Notes",
        "",
        `Use ${handle} when you need a realistic ${scenario.target} package with generated release history and template-complete support documents.`,
      ].join("\n"),
      "utf8",
    );
  } else {
    rmSync(workflowNotesFile, { force: true });
  }

  if (!scenario.includeContributingGuide) {
    rmSync(contributingFile, { force: true });
  }
  if (!scenario.includeSecurityPolicy) {
    rmSync(securityFile, { force: true });
  }

  applyLicenseMode(licenseFile, scenario.licenseMode);
}

function buildLicenseLine(mode) {
  if (mode === "none") {
    return 'license: "UNLICENSED"';
  }
  if (mode === "Apache2") {
    return 'license: "Apache-2.0 (see LICENSE)"';
  }
  if (mode === "Proprietary") {
    return 'license: "Proprietary internal reference (see LICENSE)"';
  }
  return 'license: "MIT (see LICENSE)"';
}

function applyLicenseMode(licenseFile, mode) {
  if (mode === "none") {
    rmSync(licenseFile, { force: true });
    return;
  }
  writeFileSync(licenseFile, `${licenseTexts[mode]}\n`, "utf8");
}

function buildExamplesSection(scenario) {
  const appendix = scenario.includeExamplesAppendix
    ? `\nExample F: verify release history\n- Input: "Inspect every generated release for ${scenario.skillSlug}"\n- Output:\n  - \`skillmd history @test/${scenario.skillSlug}\``
    : "";

  return [
    "## Examples",
    "",
    `Example A: validate ${scenario.skillSlug}`,
    '- Input: "Validate the generated coverage package"',
    "- Output:",
    "  - `skillmd validate --strict --parity`",
    "",
    `Example B: publish ${scenario.target} release`,
    `- Input: "Publish ${scenario.skillSlug} under ${scenario.target}"`,
    "- Output:",
    `  - \`skillmd publish --version ${scenario.publishes[0].version} --tag ${scenario.publishes[0].tag} --agent-target ${scenario.target}\``,
    appendix,
  ].join("\n");
}

function publishScenario(skillDir, scenario, options) {
  runCli(["validate", skillDir, "--strict"], repoRoot, options.verbose);
  const releases = [];

  for (const publish of scenario.publishes) {
    const args = [
      "publish",
      skillDir,
      "--version",
      publish.version,
      "--access",
      options.access,
      "--agent-target",
      scenario.target,
      "--tag",
      publish.tag,
      "--json",
    ];
    if (options.dryRun) {
      args.splice(args.length - 1, 0, "--dry-run");
    }
    const raw = runCli(args, repoRoot, options.verbose);
    const parsed = JSON.parse(raw);
    releases.push({
      requestedVersion: publish.version,
      requestedTag: publish.tag,
      status: parsed.status,
      skillId: parsed.skillId,
      version: parsed.version,
    });
  }

  return releases;
}

function main() {
  ensureTemplateExists();
  const options = parseArgs(process.argv.slice(2));
  const tempRoot = options.workspace ?? mkdtempSync(join(tmpdir(), "skillmd-edge-batch-"));
  const keepWorkspace = options.keepWorkspace || Boolean(options.workspace);

  mkdirSync(tempRoot, { recursive: true });
  const report = {
    templateRoot,
    workspace: tempRoot,
    access: options.access,
    dryRun: options.dryRun,
    count: options.count,
    versionsPerSkill: options.versionsPerSkill,
    published: [],
  };

  try {
    console.log(`Workspace: ${tempRoot}`);
    console.log(`Template: ${templateRoot}`);
    for (let index = 0; index < options.count; index += 1) {
      const scenario = buildScenario(index, options);
      const skillDir = join(tempRoot, scenario.skillSlug);
      copyTemplateSkill(skillDir);
      rewriteTemplateFiles(skillDir, scenario);
      const releases = publishScenario(skillDir, scenario, options);
      report.published.push({
        skillSlug: scenario.skillSlug,
        skillDir,
        target: scenario.target,
        contentMode: scenario.contentMode,
        licenseMode: scenario.licenseMode,
        releases,
      });
      console.log(
        `${options.dryRun ? "Prepared" : "Published"} @test/${scenario.skillSlug} (${scenario.target}, ${scenario.contentMode}, ${scenario.licenseMode})`,
      );
    }

    const reportPath = join(tempRoot, "edge-case-publish-report.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report: ${reportPath}`);
    console.log(
      JSON.stringify(
        {
          workspace: tempRoot,
          count: report.published.length,
          dryRun: options.dryRun,
          reportPath,
        },
        null,
        2,
      ),
    );
  } finally {
    if (!keepWorkspace) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main();
