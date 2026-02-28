# @skillmarkdown/cli

`@skillmarkdown/cli` is the official CLI for scaffolding, validating, and packaging `SKILL.md`-based AI skills. It provides the `skillmd` command, starting with deterministic, spec-aligned skill scaffolding via `skillmd init`.

## Status

Early development. v0 focuses on `skillmd init` and `skillmd validate`. Docs are intentionally lightweight and may evolve.

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

## Development

- Local testing guide: `docs/testing.md`
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
