---
name: claude-skill-publisher
description: Publish, install, and update skills specifically for Claude using skillmd agent-target workflows; use when a skill must land in .claude/skills and stay on Claude-targeted update paths.
---

## Scope

Operate Claude-targeted skill lifecycle commands from validation through install/update.

## When to use

Use when the requested skill workflow must target Claude roots and metadata:

- publish with `agentTarget=claude`
- install under `.claude/skills/...`
- run Claude-scoped updates

## Inputs

- skill workspace path
- skill id (`skill`)
- version, channel, visibility

## Outputs

- exact commands executed
- concise outcome summary
- next remediation command on failure

## Steps / Procedure

1. Validate before publish.

- `skillmd validate --strict`

2. Authenticate in the intended project.

- `skillmd login --reauth`

3. Publish with Claude target metadata.

- `skillmd publish --version <semver> --channel <latest|beta> --visibility <public|private> --agent-target claude`

4. Install to Claude root.

- `skillmd use <skill-id> --agent-target claude`

5. Update Claude-targeted installs.

- `skillmd update --all --agent-target claude`

## Examples

- “Publish this skill for Claude beta only.”
- “Install skill into Claude in this repo.”
- “Update all Claude-targeted skills in this project.”

## Limitations / Failure modes

- publish/install/update fail without valid login session
- private reads fail without owner access
- missing channel/version resolution blocks installs

## Security / Tool access

- never print or persist tokens
- treat signed URLs as sensitive
- confirm install path resolves under `.claude/skills/...`
