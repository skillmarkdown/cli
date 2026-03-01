import { STRICT_SECTION_TITLES } from "./skill-spec";

const SECTION_PLACEHOLDERS: Record<(typeof STRICT_SECTION_TITLES)[number], string> = {
  Scope: "Define the boundaries of this skill: what it should and should not handle.",
  "When to use":
    "Describe the signals or request patterns that should trigger this skill. Keep SKILL.md focused and move deep details into references/ files.",
  Inputs:
    "List required and optional inputs, expected formats, and assumptions. Add structured templates to references/FORMS.md when helpful.",
  Outputs:
    "Describe expected outputs, side effects, and completion criteria. Use assets/report-template.md when a fixed output structure is useful.",
  "Steps / Procedure":
    "Provide ordered steps the agent should follow, including key decision points. See [the reference guide](references/REFERENCE.md) for detailed rules. Run helper scripts such as scripts/extract.py when needed.",
  Examples: "Add one or two realistic examples of inputs and expected outputs.",
  "Limitations / Failure modes":
    "Document known limitations, failure cases, and recommended recovery actions.",
  "Security / Tool access":
    "State required tools/permissions and any security constraints. If needed, set frontmatter allowed-tools to pre-approve tool usage.",
};

export function buildSkillMarkdown(name: string): string {
  const sections = STRICT_SECTION_TITLES.map(
    (title) => `## ${title}\n\n${SECTION_PLACEHOLDERS[title]}`,
  ).join("\n\n");

  return `---
name: ${name}
description: Explain what this skill does and when an agent should use it.
# compatibility: "Optional: environment requirements (products, packages, network access)."
# metadata:
#   author: "your-org"
#   version: "1.0.0"
# allowed-tools: "Optional: space-delimited pre-approved tools."
license: Optional. Add a license name or reference to a bundled license file.
---

${sections}
`;
}

export function buildMinimalSkillMarkdown(name: string): string {
  return buildSkillMarkdown(name);
}

export function buildVerboseSkillMarkdown(name: string): string {
  return buildSkillMarkdown(name);
}

export function buildGitignore(): string {
  return `node_modules/
dist/
.DS_Store
npm-debug.log*
`;
}

export function buildScriptsReadme(): string {
  return `# scripts/

Use this folder for executable code that agents can run.

Guidelines:
- Keep scripts self-contained or clearly document dependencies.
- Emit actionable error messages.
- Handle edge cases (missing files, invalid input, empty data).

Starter script:
- \`scripts/extract.py\`
`;
}

export function buildExtractScriptPython(): string {
  return `#!/usr/bin/env python3
"""Example extraction script with defensive error handling.

Usage:
  python3 scripts/extract.py --input ./input.txt --output ./output.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract line and word statistics.")
    parser.add_argument("--input", required=True, help="Path to input text file.")
    parser.add_argument("--output", required=True, help="Path to output JSON file.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not os.path.exists(args.input):
        print(f"error: input file does not exist: {args.input}", file=sys.stderr)
        return 1

    try:
        with open(args.input, "r", encoding="utf-8") as source:
            content = source.read()
    except OSError as error:
        print(f"error: failed to read input file: {error}", file=sys.stderr)
        return 1

    lines = [line for line in content.splitlines() if line.strip()]
    result = {
        "line_count": len(lines),
        "word_count": len(content.split()),
        "preview": lines[:3],
    }

    try:
        with open(args.output, "w", encoding="utf-8") as destination:
            json.dump(result, destination, indent=2)
            destination.write("\\n")
    except OSError as error:
        print(f"error: failed to write output file: {error}", file=sys.stderr)
        return 1

    print(f"wrote extraction summary to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;
}

export function buildReferenceGuide(): string {
  return `# Reference Guide

Use this file for detailed technical reference that should not live in \`SKILL.md\`.

Suggested sections:
- Data model and field definitions
- Validation rules and constraints
- External API contract notes
- Error catalog and recovery guidance

Keep this file focused and concise. Add deeper detail in additional reference files when needed.
`;
}

export function buildFormsReference(): string {
  return `# Forms and Structured Templates

Use this file to store reusable form structures and payload templates.

## Intake Form (Example)

\`\`\`yaml
request_id: "REQ-0001"
request_type: "analysis"
priority: "normal"
inputs:
  source_path: "./input.txt"
  output_path: "./output.json"
\`\`\`

## Result Envelope (Example)

\`\`\`json
{
  "status": "ok",
  "summary": "One-line result summary",
  "artifacts": []
}
\`\`\`
`;
}

export function buildAssetsReadme(): string {
  return `# assets/

Use this folder for static resources that scripts or instructions can reference:
- templates
- lookup tables
- example data
- diagrams

Keep asset files small and task-focused.
`;
}

export function buildReportTemplate(): string {
  return `# Report Template

## Summary
- Status:
- Owner:
- Updated:

## Findings
1.
2.
3.

## Next Steps
1.
2.
`;
}

export function buildLookupTableCsv(): string {
  return `code,label,description
E001,missing_input,Required input file is missing
E002,invalid_format,Input format is invalid or unsupported
E003,write_failed,Output could not be written
`;
}
