# Contributing

Thanks for contributing to `skillmarkdown`.

## Local setup

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run check:src-loc
npm run check:pack-size
```

## Branch and PR expectations

- Keep PRs scoped and atomic.
- Base PRs on `development` unless maintainers request otherwise.
- Include test updates with behavior changes.
- Keep strict-v1 terminology and contracts in docs and tests.

## Command sweep guidance

Use command sweeps before merge when command behavior or auth flows change:

```bash
npm run sweep:commands:dev
npm run sweep:commands:prod
```

Run environments sequentially (not concurrently) to avoid auth/session drift.

If local session/project context drifts while switching environments, re-authenticate:

```bash
skillmd login --reauth
```

## Release validation

Release gate:

```bash
npm run ci:check
npm run smoke:pack
npm run smoke:link
```

Packaging checks in this repo use `npm pack --json --dry-run` as the source of truth.

## Commit quality bar

- `npm run format:check` passes.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- `npm run check:src-loc` passes (`<= 18,400` estimated code lines in `src`).
- `npm run check:pack-size` passes (`<= 260,000` unpacked bytes).
- Docs are updated for user-facing changes.

## Reporting issues in PRs

Include:

- exact command(s) run
- expected vs actual behavior
- relevant CLI output (redact tokens/secrets)
- environment (`dev` or `prod`, Node version)
