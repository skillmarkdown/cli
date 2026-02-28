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

`skillmd init` runs local validation by default (with `--no-validate` opt-out).
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

---

## D-003: Skill Artifact Philosophy

A skill is a **folder artifact**, not a single file.

`skillmd init` scaffolds:

- `SKILL.md`
- `scripts/`
- `references/`
- `assets/`

Optional directories are preserved with `.gitkeep`.

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
