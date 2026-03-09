---
name: gemini-skill-publisher
description: Publish, install, and update skills specifically for Gemini using skillmd agent-target workflows; use when a skill must install under .gemini/skills with Gemini-scoped lifecycle commands.
---

## Scope

Operate Gemini-targeted skill lifecycle commands from validation through install/update.

## When to use

Use when the requested skill workflow must target Gemini roots and metadata:

- publish with `agentTarget=gemini`
- install under `.gemini/skills/...`
- run Gemini-scoped updates

## Inputs

- skill workspace path
- skill id (`@username/skill`)
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

3. Publish with Gemini target metadata.

- `skillmd publish --version <semver> --channel <latest|beta> --visibility <public|private> --agent-target gemini`

4. Install to Gemini root.

- `skillmd use <skill-id> --agent-target gemini`

5. Update Gemini-targeted installs.

- `skillmd update --all --agent-target gemini`

## Examples

- “Publish this skill for Gemini latest.”
- “Install @username/skill for Gemini in this folder.”
- “Update all Gemini-targeted skills here.”

## Limitations / Failure modes

- publish/install/update fail without valid login session
- private reads fail without owner access
- missing channel/version resolution blocks installs

## Security / Tool access

- never print or persist tokens
- treat signed URLs as sensitive
- confirm install path resolves under `.gemini/skills/...`
