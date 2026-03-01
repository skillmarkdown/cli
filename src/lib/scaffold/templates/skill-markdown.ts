import { STRICT_SECTION_TITLES } from "../skill-spec";

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
