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
