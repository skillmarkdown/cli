# AGENTS

This repo builds `skillmarkdown` (binary: `skillmd`).

## Current scope

`skillmd` is a full registry/workspace CLI for:

- authoring: `init`, `validate`
- auth/session: `login`, `logout`, `whoami`, `token`
- publish/lifecycle: `publish`, `tag`, `deprecate`, `unpublish`, `history`
- discovery/install: `search`, `view`, `use`, `install`, `list`, `remove`, `update`

## Tech

- Node + TypeScript
- keep dependencies minimal
- build output is the bundled `dist/cli.js`

## Project rules

- Prefer small, composable modules in `src/`.
- Keep docs and tests aligned with command behavior in the same change.
- Do not reintroduce username-to-email lookup.
- Team command surfaces belong under `skillmd org ...`; do not add a separate top-level `team` command.
- Templates and lockfile behavior must stay deterministic and reviewable.
- Keep built-in agent-target support aligned with backend support.

## Definition of done

Use:

- `README.md` for public command/docs accuracy
- `docs/production-ready-checklist.md` for release readiness
- the automated test suite as the behavior acceptance checklist

Required validation before merge:

- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`

Release validation:

- `npm run ci:check`
- `npm run smoke:pack`
- `npm run smoke:link`

Packaging checks use `npm pack --json --dry-run` as the source of truth.

## Release automation

- Publishing is automated by `.github/workflows/publish.yml` on pushes to `main`.
- The expected branch flow is `development -> main` for releases.
- The workflow uses npm Trusted Publishing (OIDC) and publishes with provenance.
- If the current `package.json` version is already on npm, the workflow auto-bumps:
  - `major` if commit messages include `BREAKING CHANGE` or `type!:`
  - `minor` if commit messages include `feat:`
  - `patch` otherwise
- The auto-bump commit message includes `[skip ci]` to avoid recursive workflow loops.
- After a successful publish auto-bump, the workflow cherry-picks the bot-created release commit back onto `development` so version changes do not drift.
- Do not manually repair version drift on `development`; inherit release bumps from the automated release-commit sync.
