# Decisions

This document records stable, durable architectural decisions for `@skillmarkdown/cli` (binary: `skillmd`).

If a change conflicts with a decision here, this file must be updated in the same PR.

---

## D-001: Package + Command Naming

- npm package: `@skillmarkdown/cli`
- Installed binary command: `skillmd`

Rationale:
Scoped package avoids naming collisions while preserving a clean command surface.

---

## D-002: v0 Scope is Intentionally Narrow

v0 implements `skillmd init` and `skillmd validate`.

`skillmd init` runs local validation by default (with `--no-validate` opt-out), with behavior depending on template mode.
`skillmd validate` runs spec checks by default, with `--strict` for scaffold/template checks.
`skillmd validate --parity` cross-checks local status against `skills-ref` to detect drift.

No:

- registry calls
- authentication
- publishing
- runtime execution
- marketplace integration

Rationale:
We establish deterministic scaffolding before adding complexity.

Note:
Post-v0 command extensions are tracked in D-006 (`login` / `logout`) and D-007 (`publish`).

---

## D-006: Login Command Is Introduced as a Post-v0 Extension

`skillmd login` is a post-v0 command to establish authenticated CLI context.

Contract:

- `skillmd login` starts GitHub Device Flow and exchanges the GitHub access token with Firebase Identity Toolkit (`accounts:signInWithIdp`).
- `skillmd login --status` reports whether a local session exists and shows the session Firebase project id.
- `skillmd login --reauth` forces a new auth flow even when a local session exists.
- when a local session exists, `skillmd login` verifies the stored refresh token and automatically reauthenticates if the token is invalid/expired.
- if existing-session verification is inconclusive (e.g. network timeout), `skillmd login` exits non-zero and keeps the current session to avoid false-positive success.
- `skillmd logout` removes the local session.
- local persistence stores only the Firebase `refreshToken` plus minimal identity metadata.
- command execution has built-in defaults; overrides are read from `SKILLMD_GITHUB_CLIENT_ID`, `SKILLMD_FIREBASE_API_KEY`, `SKILLMD_FIREBASE_PROJECT_ID`, and trusted user config at `~/.skillmd/.env`.

Rationale:
Authentication is needed for future remote operations, while preserving secret minimization (no GitHub client secret in CLI).

---

## D-003: Skill Artifact Philosophy

A skill is a **folder artifact**, not a single file.

`skillmd init` default (`--template minimal`) scaffolds:

- `SKILL.md`

`skillmd init --template verbose` scaffolds:

- `SKILL.md`
- `.gitignore`
- `scripts/` (with starter placeholders)
- `references/` (with starter placeholders)
- `assets/` (with starter placeholders)

Verbose-template optional directories are preserved with `.gitkeep`.
Both templates generate the same `SKILL.md` body/frontmatter template.

Rationale:
Aligns with AgentSkills specification and supports future packaging + hashing.

---

## D-004: Determinism is Mandatory

Scaffolding must produce identical output given identical inputs.

No randomness. No timestamps.

Rationale:
Future packaging will rely on hash-based immutability.

---

## D-005: Immutable Artifact Direction (Future Anchor)

Published skill versions will eventually be treated as immutable, hashable artifacts.

Although not implemented in v0, all CLI decisions must preserve this direction.

---

## D-007: Publish Command Uses Immutable Digest-Backed Semver Artifacts

`skillmd publish` is a post-v0 command for registry publishing.

Contract:

- command surface:
  - `skillmd publish [path] --owner <owner-slug> --version <semver> [--channel <latest|beta>] [--dry-run] [--json]`
- strict local validation is mandatory before packaging/publish.
- artifact packaging is deterministic and produces a canonical digest (`sha256:<hex>`).
- version immutability:
  - same `owner/skill@version` + same digest => idempotent success.
  - same `owner/skill@version` + different digest => conflict failure.
- default channel selection:
  - prerelease semver => `beta`
  - stable semver => `latest`
- authenticated write model:
  - publish requires local login session.
  - CLI exchanges Firebase refresh token for ID token at publish time.
  - CLI never stores backend secrets.
- CLI env overrides for registry client:
  - `SKILLMD_REGISTRY_BASE_URL`
  - `SKILLMD_REGISTRY_TIMEOUT_MS`

Rationale:
This keeps the publish surface simple while preserving integrity guarantees required for future search/install workflows.
