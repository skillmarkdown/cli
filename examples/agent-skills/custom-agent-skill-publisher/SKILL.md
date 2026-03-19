---
name: custom-agent-skill-publisher
description: Publish, install, and update skills for custom agents via skillmd custom target slugs; use when deployment must resolve to .agents/skills/<slug>/... using custom:<slug> semantics.
---

## Scope

Operate custom-target skill lifecycle commands using `custom:<slug>` conventions.

## When to use

Use when the requested skill workflow must target a custom agent root:

- publish with `agentTarget=custom:<slug>`
- install under `.agents/skills/<slug>/...`
- run custom-target scoped updates

## Inputs

- custom target (`custom:<slug>`)
- skill workspace path
- skill id (`skill`)
- version, channel, visibility

## Outputs

- exact commands executed
- concise outcome summary
- next remediation command on failure

## Steps / Procedure

1. Validate package and slug.

- `skillmd validate --strict`
- ensure slug matches lowercase `custom:<slug>` grammar

2. Authenticate in the intended project.

- `skillmd login --reauth`

3. Publish with custom target metadata.

- `skillmd publish --version <semver> --channel <latest|beta> --visibility <public|private> --agent-target custom:<slug>`

4. Install to custom root.

- `skillmd use <skill-id> --agent-target custom:<slug>`

5. Update custom-target installs.

- `skillmd update --all --agent-target custom:<slug>`

## Examples

- “Publish this skill for custom:myagent.”
- “Install skill under custom:researchbot.”
- “Update all custom:myagent skills in this repo.”

## Limitations / Failure modes

- publish/install/update fail without valid login session
- invalid custom slug causes argument validation failure
- missing channel/version resolution blocks installs

## Security / Tool access

- never print or persist tokens
- treat signed URLs as sensitive
- confirm install path resolves under `.agents/skills/<slug>/...`
