# @skillmarkdown/cli

`@skillmarkdown/cli` is the official CLI for scaffolding, validating, and packaging `SKILL.md`-based AI skills. It provides the `skillmd` command, starting with deterministic, spec-aligned skill scaffolding via `skillmd init`.

## Status

Early development. Current command surface includes `skillmd init`, `skillmd validate`, `skillmd login`, and `skillmd logout`. Docs are intentionally lightweight and may evolve.

## Install

### Global install

```bash
npm i -g @skillmarkdown/cli
```

### Run without installing

```bash
npx @skillmarkdown/cli init
```

## Usage

### Initialize a skill folder

```bash
skillmd init
```

This scaffolds a spec-aligned skill structure including `SKILL.md` and optional directories (`scripts/`, `references/`, `assets/`), then runs local validation.

To skip validation during init:

```bash
skillmd init --no-validate
```

### Validate a skill folder

```bash
skillmd validate
```

Default `validate` is spec-only. It checks `SKILL.md` and frontmatter rules, and does not require scaffold directories/files.

You can also pass an explicit path:

```bash
skillmd validate /path/to/skill
```

Run additional scaffold/template checks:

```bash
skillmd validate --strict
```

`--strict` is intentionally stronger than base spec mode and enforces scaffold/template conventions (for example `.gitkeep` files and required section headings).

Compare local validation with `skills-ref` (when installed):

```bash
skillmd validate --parity
```

### Login with GitHub (Device Flow)

```bash
skillmd login
```

By default, `login` uses the project’s built-in development config. You can override values with shell env vars or `~/.skillmd/.env`:

- `SKILLMD_GITHUB_CLIENT_ID`
- `SKILLMD_FIREBASE_API_KEY`

See `.env.example` for the expected keys.
Maintainers: built-in defaults are defined in `src/lib/auth-defaults.ts`.

Example override file:

```bash
mkdir -p ~/.skillmd
cp .env.example ~/.skillmd/.env
# then edit values in ~/.skillmd/.env if needed
```

Session helpers:

```bash
skillmd login --status
skillmd login --reauth
skillmd logout
```

When a saved session exists, `skillmd login` verifies the stored refresh token. If it is invalid/expired, the CLI automatically starts a new login flow. If verification is inconclusive (for example network timeout), the command exits non-zero and keeps the current session.

## Development

- Local testing guide (includes manual `login` auth checks): `docs/testing.md`
- CI check script: `npm run ci:check`
- Packed tarball smoke test: `npm run smoke:pack`
- Optional npm link smoke test: `npm run smoke:link`

### Auto versioning on main

The publish workflow auto-bumps only when the current package version is already published:

- `major`: commit message contains `BREAKING CHANGE` or `type!:` marker
- `minor`: at least one `feat:` commit
- `patch`: default fallback

Using Conventional Commit-style messages keeps release behavior predictable.

## Links

- Agent Skills spec: https://agentskills.io/specification

## License

MIT
