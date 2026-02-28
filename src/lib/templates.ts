import { STRICT_SECTION_TITLES } from "./skill-spec";

export function buildSkillMarkdown(name: string): string {
  const sections = STRICT_SECTION_TITLES.map((title) => `## ${title}\nTODO`).join("\n\n");

  return `---
name: ${name}
description: "TODO: Describe what this skill does and when to use it."
license: TODO
---

${sections}
`;
}

export function buildGitignore(): string {
  return `node_modules/
dist/
.DS_Store
npm-debug.log*
`;
}
