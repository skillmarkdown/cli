# Production-Ready Checklist

Use this checklist before releasing `skillmarkdown`.

## Release gate

- [ ] Confirm all public account and namespace behavior uses `username`.
- [ ] Confirm docs and examples do not reintroduce legacy owner identity fields.
- [ ] Confirm built-in provider target support stays aligned with backend support.
- [ ] Review user-facing command output, help text, and error messages for regressions.

## Required validation

Run:

```bash
npm run ci:check
npm run e2e:release
```

Packaging source of truth:

- [ ] `npm pack --json --dry-run` reports the intended published files, including `dist/cli.js`.

Exploratory command sweeps:

```bash
npm run sweep:commands:dev
npm run sweep:commands:dev:extended
```

Checklist:

- [ ] Formatting passes.
- [ ] Lint passes.
- [ ] Unused code check passes.
- [ ] Source size guard passes.
- [ ] Full test suite passes.
- [ ] Pack size check passes.
- [ ] Core release E2E passes.
- [ ] Extended/admin release E2E passes.
- [ ] Contract/local release E2E passes.

## Packaging and publishability

- [ ] `dist/` is reproducible from a clean build.
- [ ] The published package contains required runtime files only.
- [ ] The `skillmd` executable works after install.
- [ ] Pack verification uses `npm pack --json --dry-run`, not the human-readable `npm pack` summary.
- [ ] `prepublishOnly` succeeds from a clean state.
- [ ] README examples match actual command behavior.
- [ ] README command examples match `src/lib/shared/cli-text.ts` usage strings after command-surface changes.
- [ ] Strict E2E fixture env vars are present for dev release gating.

## Auth and environment safety

- [ ] Local development commands target dev services unless production is explicitly requested.
- [ ] Token, session, and interactive login flows behave correctly.
- [ ] Non-interactive login for release automation uses fixture credentials only.
- [ ] Auth precedence remains CLI flag, then environment, then interactive session.
- [ ] Commands fail clearly when auth is missing or underscoped.

## Product behavior

- [ ] `init` output remains deterministic.
- [ ] `create` output remains deterministic and writes to a new target directory only.
- [ ] `validate` stays offline and spec-aligned.
- [ ] Publishability checks reject disallowed binary media files while still allowing text-first assets and `svg`.
- [ ] Publish, install, update, and remove flows work end to end.
- [ ] Search, view, history, and tag commands behave consistently.
- [ ] JSON output remains machine-friendly for automation.
- [ ] Tiered command sweep covers every shipped CLI command.
- [ ] Command matrix audit covers every shipped command and documented variant.

## Release readiness

- [ ] npm version and changelog intent are correct.
- [ ] Release automation expectations match current workflow behavior.
- [ ] Support and troubleshooting docs cover newly changed behavior.
- [ ] Rollback plan is clear if a bad package is published.

## Post-release smoke

- [ ] `npx skillmarkdown --version` works.
- [ ] Fresh global install works.
- [ ] One-off `npx` execution works.
- [ ] Login, publish, search, and install succeed in the intended environment.
- [ ] No critical packaging or runtime regressions appear after publish.
