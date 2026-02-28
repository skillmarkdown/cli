# AGENTS

This repo builds `@skillmarkdown/cli` (binary: `skillmd`).

## Goal (v0)
Implement **only** `skillmd init`:
- scaffolds a spec-aligned skill folder
- deterministic output (no timestamps, randomness, or machine-specific paths)
- no network calls

## Tech
- Node + TypeScript
- Keep dependencies minimal.

## Project rules
- Prefer small, composable modules in `src/`.
- Do not add new commands without updating `docs/mvp.md` and `docs/DECISIONS.md`.
- Templates must be stable (changes should be intentional and reviewable).

## Definition of done
Use `docs/mvp.md` as the acceptance checklist for v0.
