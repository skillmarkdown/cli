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

6. View skill details:

```bash
skillmd view @owner/skill
```

7. View version history for a skill:

```bash
skillmd history @owner/skill --limit 20
```

8. Install a published skill into the current workspace:

```bash
skillmd use @owner/skill
```

9. Update installed skills in the current workspace:

```bash
skillmd update --all
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
skillmd publish [path] --version <semver> [--channel <latest|beta>] [--visibility <public|private>] [--dry-run] [--json]
```

Notes:

- Always runs strict local validation before publishing.
- Owner is derived by the registry from your authenticated GitHub identity (`@githubusername`).
- Default channel is `latest` for stable versions and `beta` for prerelease versions.
- Default visibility is `public`.
- Use `--visibility private` for owner-only registry reads/install.

### `skillmd search`

Search registry skills.

```bash
skillmd search [query] [--limit <1-50>] [--cursor <token>] [--scope <public|private>] [--json]
```

Notes:

- No `query` means browse latest published skills.
- Results include `skillId` (`@owner/skill`) and channel pointers.
- `#` row numbers continue across `--cursor` pages for the same query and limit.
- `--scope` defaults to `public`.
- `--scope private` requires login and returns owner-only private skills.

Example human output:

```text
┌────┬──────────────────────────────────────┬────────────┬──────────────────┬──────────────────────────────────────────────────────────────────┐
│  # │ SKILL                                │ LATEST     │ UPDATED          │ DESCRIPTION                                                      │
├────┼──────────────────────────────────────┼────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│  1 │ @core/agent-skill                    │ 1.0.0      │ 2026-03-02T09:00 │ Sample description                                               │
└────┴──────────────────────────────────────┴────────────┴──────────────────┴──────────────────────────────────────────────────────────────────┘
Next page: skillmd search agent --limit 10 --cursor <token>
```

### `skillmd view`

Show full details for a specific skill.

```bash
skillmd view <skill-id|index> [--json]
```

Notes:

- `<skill-id>` accepts `@owner/skill` or `owner/skill`.
- `<index>` resolves from the visible `#` values on the most recent `skillmd search` result page (for example `skillmd view 4`).
- Shows owner, visibility, full channel pointers, update time, and description.

### `skillmd history`

List published versions for a single skill.

```bash
skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]
```

Notes:

- `<skill-id>` accepts `@owner/skill` or `owner/skill`.
- Output includes digest, publish timestamp, artifact size/media type, and yank metadata.

Example human output:

```text
┌────────────┬──────────────────────┬──────────────────────────┬────────────┬───────────────────────┬────────────────────────────────────────────┐
│ VERSION    │ PUBLISHED            │ YANKED                   │ SIZE       │ DIGEST                │ MEDIA                                      │
├────────────┼──────────────────────┼──────────────────────────┼────────────┼───────────────────────┼────────────────────────────────────────────┤
│ 1.2.3      │ 2026-03-02T09:00:... │ yes:security issue       │      12345 │ sha256:1234567890ab...│ application/vnd.skillmarkdown.skill.v1+tar │
└────────────┴──────────────────────┴──────────────────────────┴────────────┴───────────────────────┴────────────────────────────────────────────┘
Next page: skillmd history @owner/skill --limit 20 --cursor <token>
```

### `skillmd use`

Install a published skill into this workspace.

```bash
skillmd use <skill-id> [--version <semver> | --channel <latest|beta>] [--allow-yanked] [--json]
```

Notes:

- Default selector is `latest` when `--version`/`--channel` are omitted; if `latest` is unset, CLI falls back to `beta`.
- Installed path is `.agent/skills/registry.skillmarkdown.com/<owner>/<skill>` under current working directory (same in dev and prod).
- Existing target install path is replaced atomically.

### `skillmd update`

Update installed skills in this workspace.

```bash
skillmd update [skill-id ...] [--all] [--allow-yanked] [--json]
```

Notes:

- `skillmd update` and `skillmd update --all` are equivalent.
- `--all` scans `.agent/skills/registry.skillmarkdown.com/*/*` in the current directory.
- explicit IDs only update those installed skills; missing installs are reported as failures.
- version-pinned installs are skipped (non-fatal).
- batch mode continues on per-skill errors and exits non-zero if any failures occur.

## Learn More

- Agent Skills specification: [agentskills.io/specification](https://agentskills.io/specification)

## License

MIT
