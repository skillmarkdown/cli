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
npm run smoke:pack
npm run smoke:link
```

Recommended command sweeps before release:

```bash
npm run sweep:commands:dev
npm run sweep:commands:prod
```

Checklist:

- [ ] Formatting passes.
- [ ] Lint passes.
- [ ] Unused code check passes.
- [ ] Source size guard passes.
- [ ] Full test suite passes.
- [ ] Pack size check passes.
- [ ] Packed install smoke passes.
- [ ] Linked install smoke passes.
- [ ] Dev command sweep passes at an acceptable level.
- [ ] Prod command sweep passes at an acceptable level.

## Packaging and publishability

- [ ] `dist/` is reproducible from a clean build.
- [ ] The published package contains required runtime files only.
- [ ] The `skillmd` executable works after install.
- [ ] `prepublishOnly` succeeds from a clean state.
- [ ] README examples match actual command behavior.

## Auth and environment safety

- [ ] Local development commands target dev services unless production is explicitly requested.
- [ ] Token, session, and interactive login flows behave correctly.
- [ ] Auth precedence remains CLI flag, then environment, then interactive session.
- [ ] Commands fail clearly when auth is missing or underscoped.

## Product behavior

- [ ] `init` output remains deterministic.
- [ ] `validate` stays offline and spec-aligned.
- [ ] Publish, install, update, and remove flows work end to end.
- [ ] Search, view, history, and tag commands behave consistently.
- [ ] JSON output remains machine-friendly for automation.

## Release readiness

- [ ] npm version and changelog intent are correct.
- [ ] Release automation expectations match current workflow behavior.
- [ ] Support and troubleshooting docs cover newly changed behavior.
- [ ] Rollback plan is clear if a bad package is published.

## Post-release smoke

- [ ] `npx skillmarkdown --help` works.
- [ ] Fresh global install works.
- [ ] One-off `npx` execution works.
- [ ] Login, publish, search, and install succeed in the intended environment.
- [ ] No critical packaging or runtime regressions appear after publish.
