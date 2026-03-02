# @skillmarkdown/cli

`@skillmarkdown/cli` is the official CLI for creating, validating, and publishing Agent Skills.

## Install

```bash
npm i -g @skillmarkdown/cli
```

Or run without installing:

```bash
npx @skillmarkdown/cli init
```

## Quick Start

1. Create a new skill folder and scaffold `SKILL.md`:

```bash
mkdir my-skill && cd my-skill
skillmd init
```

2. Validate your skill:

```bash
skillmd validate
```

3. Log in (required for publish):

```bash
skillmd login
```

4. Publish your skill:

```bash
skillmd publish --version 1.0.0
```

5. Search published skills:

```bash
skillmd search agent --limit 10
```

6. View version history for a skill:

```bash
skillmd history @owner/skill --limit 20
```

7. Install a published skill into the current workspace:

```bash
skillmd use @owner/skill
```

## Commands

### `skillmd init`

Create a new skill scaffold in the current directory.

```bash
skillmd init [--template <minimal|verbose>] [--no-validate]
```

- `minimal` (default): creates only `SKILL.md`
- `verbose`: creates `SKILL.md` plus helpful starter files in `scripts/`, `references/`, and `assets/`
- `--no-validate`: skip validation right after scaffold creation

### `skillmd validate`

Validate a skill directory.

```bash
skillmd validate [path] [--strict] [--parity]
```

- default: spec validation
- `--strict`: stronger scaffold/template checks
- `--parity`: compare with `skills-ref` (if installed)

### `skillmd login`

Authenticate with GitHub Device Flow.

```bash
skillmd login [--status|--reauth]
```

- `--status`: show current login status and active project
- `--reauth`: force a fresh login

### `skillmd logout`

Clear local session.

```bash
skillmd logout
```

### `skillmd publish`

Package and publish a skill artifact.

```bash
skillmd publish [path] --version <semver> [--channel <latest|beta>] [--dry-run] [--json]
```

Notes:

- Always runs strict local validation before publishing.
- Owner is derived by the registry from your authenticated GitHub identity (`@githubusername`).
- Default channel is `latest` for stable versions and `beta` for prerelease versions.

### `skillmd search`

Search public registry skills.

```bash
skillmd search [query] [--limit <1-50>] [--cursor <token>] [--json]
```

Notes:

- No `query` means browse latest published skills.
- Results include `skillId` (`@owner/skill`) and channel pointers.

### `skillmd history`

List published versions for a single skill.

```bash
skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]
```

Notes:

- `<skill-id>` accepts `@owner/skill` or `owner/skill`.
- Output includes digest, publish timestamp, artifact size/media type, and yank metadata.

### `skillmd use`

Install a published skill into this workspace.

```bash
skillmd use <skill-id> [--version <semver> | --channel <latest|beta>] [--allow-yanked] [--json]
```

Notes:

- Default selector is `latest` channel when `--version`/`--channel` are omitted.
- Installed path is `.agent/skills/<registry-host>/<owner>/<skill>` under current working directory.
- Existing target install path is replaced atomically.

## Optional Configuration

Most users can run with defaults.

For custom environments, you can set:

- `SKILLMD_GITHUB_CLIENT_ID`
- `SKILLMD_FIREBASE_API_KEY`
- `SKILLMD_FIREBASE_PROJECT_ID`
- `SKILLMD_REGISTRY_BASE_URL`
- `SKILLMD_REGISTRY_TIMEOUT_MS`

You can place these in `~/.skillmd/.env`.

## Learn More

- Agent Skills specification: [agentskills.io/specification](https://agentskills.io/specification)

## License

MIT
