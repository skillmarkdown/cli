# AGENTS

This repo builds `@skillmarkdown/cli` (binary: `skillmd`).

## Goal (v0)

Implement `skillmd init` and `skillmd validate`:

- `init` scaffolds a spec-aligned skill folder
- output is deterministic (no timestamps, randomness, or machine-specific paths)
- `validate` provides local spec checks, with strict/parity modes
- no network calls during command execution

## Tech

- Node + TypeScript
- Keep dependencies minimal.

## Project rules

- Prefer small, composable modules in `src/`.
- Do not add new commands without updating `docs/DECISIONS.md`.
- Templates must be stable (changes should be intentional and reviewable).

## Definition of done

For v0, rely on:

- `docs/DECISIONS.md` for scope and architecture constraints.
- The automated test suite as the behavior acceptance checklist.

## Release automation

- Publishing is automated by `.github/workflows/publish.yml` on pushes to `main`.
- The workflow uses npm Trusted Publishing (OIDC) and publishes with provenance.
- If the current `package.json` version is already on npm, the workflow auto-bumps:
  - `major` if commit messages include `BREAKING CHANGE` or `type!:`
  - `minor` if commit messages include `feat:`
  - `patch` otherwise
- The auto-bump commit message includes `[skip ci]` to avoid recursive workflow loops.
