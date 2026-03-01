# @skillmarkdown/cli

`@skillmarkdown/cli` is the official CLI for scaffolding, validating, and packaging `SKILL.md`-based AI skills. It provides the `skillmd` command, starting with deterministic, spec-aligned skill scaffolding via `skillmd init`.

## Status

Early development. Current command surface includes `skillmd init`, `skillmd validate`, `skillmd login`, `skillmd logout`, and `skillmd publish`.

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

Default `init` creates the minimal filesystem scaffold:

- `SKILL.md` only

and runs spec validation.

To scaffold the full verbose template:

```bash
skillmd init --template verbose
```

The `verbose` template includes `SKILL.md`, `.gitignore`, and optional directories (`scripts/`, `references/`, `assets/`) with starter placeholder content and `.gitkeep`, then runs strict validation.

Included starter files:

- `scripts/README.md`
- `scripts/extract.py`
- `references/REFERENCE.md`
- `references/FORMS.md`
- `assets/README.md`
- `assets/report-template.md`
- `assets/lookup-table.csv`

`SKILL.md` content is the same across `minimal` and `verbose` templates. Template selection only changes extra scaffold files/directories around `SKILL.md`.

To skip validation during init:

```bash
skillmd init --no-validate
```

Supported templates:

- `minimal` (default)
- `verbose`

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
- `SKILLMD_FIREBASE_PROJECT_ID`

See `.env.example` for the expected keys.
Maintainers: built-in defaults are defined in `src/lib/auth/defaults.ts`.

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

`skillmd login --status` includes the authenticated Firebase project so you can confirm whether the active session is for `skillmarkdown` or `skillmarkdown-development`.

When a saved session exists, `skillmd login` verifies the stored refresh token. If it is invalid/expired, the CLI automatically starts a new login flow. If verification is inconclusive (for example network timeout), the command exits non-zero and keeps the current session.

### Publish a skill artifact

```bash
skillmd publish [path] --version <semver>
```

Optional flags:

- `--channel <latest|beta>`
- `--dry-run`
- `--json`

Notes:

- `publish` always runs strict local validation before packaging/upload.
- owner is derived by the registry from your authenticated GitHub identity as `@githubusername`.
- versions are immutable and content-addressed by digest (`sha256:...`).
- default channel is `latest` for stable semver and `beta` for prerelease semver.
- `publish` requires an existing authenticated session (`skillmd login`).
- if session project and current config project differ, run `skillmd login --reauth`.

Registry env overrides:

- `SKILLMD_REGISTRY_BASE_URL`
- `SKILLMD_REGISTRY_TIMEOUT_MS` (milliseconds, default `10000`)

## Development

- Local testing guide (includes manual `login` and `publish` checks): `docs/testing.md`
- CI check script: `npm run ci:check`
- Packed tarball smoke test: `npm run smoke:pack`
- Optional npm link smoke test: `npm run smoke:link`

### Publish docs

- Registry model: `docs/publish-registry.md`
- HTTP contract: `docs/publish-api.md`

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
