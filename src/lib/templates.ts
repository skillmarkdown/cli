export function buildSkillMarkdown(name: string): string {
  return `---
name: ${name}
description: TODO: Describe what this skill does and when to use it.
license: TODO
---

## Scope
TODO

## When to use
TODO

## Inputs
TODO

## Outputs
TODO

## Steps / Procedure
TODO

## Examples
TODO

## Limitations / Failure modes
TODO

## Security / Tool access
TODO
`;
}

export function buildGitignore(): string {
  return `node_modules/
dist/
.DS_Store
npm-debug.log*
`;
}
