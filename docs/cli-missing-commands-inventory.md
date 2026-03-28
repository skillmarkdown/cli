# CLI Missing Commands Inventory

## Summary

This document inventories the current gaps between the backend capability surface and the `skillmd` CLI surface, with emphasis on agentic AI convenience.

The CLI is already strong on:

- skill authoring
- publish lifecycle
- install and update flows
- account auth basics
- organization create/member/team/token workflows

The main remaining gaps are in:

- organization parity
- collaborator management
- account/support/security workflows
- a few lower-priority read and identity-management helpers

This inventory is split into:

- the **top 8 missing commands**
- a **verbose lower-priority list** of additional potential gaps

## Top 8 Missing Commands

### 1. `skillmd org get <org>`

Why it matters:

- backend supports direct organization reads
- CLI currently has `org ls` and nested org subcommands, but no simple “show me this org” command
- this is a basic parity and operability gap

Suggested behavior:

- return slug, owner handle, createdAt
- later may include viewer role and compact summary fields if useful

Priority:

- high

### 2. `skillmd org rm <org>`

Why it matters:

- backend supports organization deletion
- CLI cannot currently complete the org lifecycle end to end
- this leaves destructive org management web-only

Suggested behavior:

- interactive confirmation by default
- `--json` support
- preserve backend failure messages for non-empty orgs, ownership failures, and token restrictions

Priority:

- high

### 3. `skillmd org members set-role <org> <username> --role <owner|admin|member>`

Why it matters:

- backend supports membership role updates
- CLI only supports add/remove
- this is a real org-admin contract hole

Suggested behavior:

- update one member role
- preserve backend owner-safety checks such as “cannot demote last owner”

Priority:

- high

### 4. `skillmd org avatar set|clear <org> ...`

Why it matters:

- backend supports organization avatar writes
- org identity management is incomplete in CLI without it
- agentic/admin workflows should not require the web app for a basic org identity update

Suggested behavior:

- `set <org> <avatar-url>`
- `clear <org>`
- keep it URL-based only, matching backend behavior

Priority:

- high

### 5. `skillmd collaborators ls|add|rm <skill-id> ...`

Why it matters:

- backend supports skill collaborator management
- no CLI command exists for this at all
- this is a meaningful creator/workflow gap for real team operation

Suggested behavior:

- list collaborators
- add collaborator by username
- remove collaborator by username

Priority:

- high

### 6. `skillmd account delete`

Why it matters:

- backend supports account deletion
- CLI has no way to trigger it
- this leaves a meaningful account-management action unavailable outside web

Suggested behavior:

- high-friction confirmation
- preserve backend recent-auth requirements where applicable

Priority:

- medium

### 7. `skillmd account support ...`

Why it matters:

- backend supports support request submission
- no CLI support exists
- useful for agentic or terminal-first escalation workflows

Suggested behavior:

- create support request with subject and message
- preserve backend messages and authentication requirements

Priority:

- medium

### 8. `skillmd report malware ...`

Why it matters:

- backend supports malware reporting
- an older CLI spec already exists in [report-malware-spec.md](/Users/azk/Desktop/workspace/skillmarkdown/cli/docs/report-malware-spec.md)
- there is still no shipped command

Suggested behavior:

- likely under `skillmd report malware`
- should support skill id, reason, optional version, optional source/evidence fields

Priority:

- medium

## Verbose Lower-Priority Inventory

These are additional potentially missing commands or thin areas that are worth tracking, even if they are lower priority than the top 8.

### A. `skillmd avatar set|clear`

Status:

- backend supports user avatar writes
- CLI has no user-avatar management command

Why it may matter:

- useful for terminal-first identity management
- less central than org parity or collaborator workflows

Priority:

- low to medium

### B. `skillmd account skills`

Status:

- backend supports account-owned skills listing
- CLI does not expose a direct remote “my published skills” command

Why it may matter:

- agentic convenience for account inventory and lifecycle scripting
- current alternatives are indirect

Priority:

- low to medium

### C. `skillmd profile skills <owner>`

Status:

- backend supports profile skill listing
- CLI does not expose a direct owner/profile inventory read

Why it may matter:

- useful for creator/storefront inspection
- partially covered by `search`, but not the same thing

Priority:

- low to medium

### D. `skillmd org avatar get`

Status:

- backend org read path and web surfaces expose enough to justify a dedicated read if avatar management becomes important

Why it may matter:

- not necessary if `org get` later includes avatarUrl
- likely absorbed by `org get` instead of a standalone command

Priority:

- low

### E. `skillmd stats public`

Status:

- backend supports public stats
- no CLI command exists

Why it may matter:

- useful for operator or market-overview scripting
- not core to creator workflows

Priority:

- low

### F. `skillmd landing`

Status:

- backend supports landing aggregates
- no CLI surface exists

Why it may matter:

- could be useful for agentic discovery or smoke checks
- likely lower value than search/profile/account reads

Priority:

- low

### G. `skillmd resolve <skill-id> --spec ...`

Status:

- backend supports resolve
- current user flows usually go through `view`, `use`, `install`, or `update`

Why it may matter:

- useful for deterministic agentic resolution flows
- but largely an advanced helper rather than a missing core workflow

Priority:

- low

### H. `skillmd versions <skill-id>`

Status:

- backend supports paged versions list
- current CLI has `history`, which may already cover most of the need

Why it may matter:

- may not actually be missing if `history` is sufficient
- only worth adding if `history` is semantically overloaded

Priority:

- low

### I. `skillmd readme <skill-id>`

Status:

- backend supports direct README reads
- `view` likely covers most practical usage

Why it may matter:

- could help agentic workflows that only need README/body content
- probably not worth a separate command unless `view` is intentionally broad

Priority:

- low

### J. `skillmd whoami --full`

Status:

- `whoami` exists
- may still be thin for agentic workflows

Why it may matter:

- richer account/org/team context can help automation
- could be a flag enhancement rather than a new command

Priority:

- low

### K. Better org lifecycle completeness

Even after the top 8, org UX may still want:

- richer `org get` output
- deletion confirmation ergonomics
- team/member mutation summaries optimized for automation

These are not separate commands, but they are important for CLI maturity.

Priority:

- low to medium

### L. Better machine-oriented read flags

Some existing commands may not need brand new verbs, but may still need better automation ergonomics:

- stable `--json` shapes
- narrower output flags
- better cursor/limit flags on read commands

This is not a command gap, but it is relevant for agentic AI convenience.

Priority:

- low to medium

## Current Recommendation

If the CLI is expanded in phases, the best order is:

1. org parity
   - `org get`
   - `org rm`
   - `org members set-role`
   - `org avatar set|clear`
2. skill team-operation parity
   - `collaborators ls|add|rm`
3. account/support/security workflows
   - `account delete`
   - `account support`
   - `report malware`

This order gives the biggest day-to-day operator and agentic value first.
