# @skillmarkdown/cli

`@skillmarkdown/cli` helps you create, validate, publish, find, and use Agent Skills.

## Install

```bash
npm i -g @skillmarkdown/cli
```

Or run without installing:

```bash
npx @skillmarkdown/cli init
```

## Quick Start

1. Create a new skill:

```bash
mkdir my-skill && cd my-skill
skillmd init
```

2. Check it:

```bash
skillmd validate
```

3. Sign in:

```bash
skillmd login
```

4. Publish:

```bash
skillmd publish --version 1.0.0
```

5. Find and use skills:

```bash
skillmd search agent
skillmd view @owner/skill
skillmd history @owner/skill
skillmd use @owner/skill
skillmd update --all
```

## Commands

### `skillmd init`

Create a new skill in the current folder.

```bash
skillmd init [--template <minimal|verbose>] [--no-validate]
```

- `minimal` (default): creates `SKILL.md`
- `verbose`: creates `SKILL.md` plus starter folders/files

### `skillmd validate`

Check that a skill is valid.

```bash
skillmd validate [path] [--strict] [--parity]
```

- `--strict`: stronger checks
- `--parity`: compare with `skills-ref` if installed

### `skillmd login`

Sign in with GitHub.

```bash
skillmd login [--status|--reauth]
```

### `skillmd logout`

Sign out locally.

```bash
skillmd logout
```

### `skillmd publish`

Publish a skill version.

```bash
skillmd publish [path] --version <semver> [--channel <latest|beta>] [--visibility <public|private>] [--dry-run] [--json]
```

### `skillmd search`

Find skills in the registry.

```bash
skillmd search [query] [--limit <1-50>] [--cursor <token>] [--scope <public|private>] [--json]
```

- No `query` shows the latest skills
- Use `--scope private` to see your private skills

### `skillmd view`

Show details for one skill.

```bash
skillmd view <skill-id|index> [--json]
```

- `<skill-id>` can be `@owner/skill` or `owner/skill`
- `<index>` uses the number shown in your latest `search` results

### `skillmd history`

Show published versions for one skill.

```bash
skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]
```

### `skillmd use`

Install a skill into the current project.

```bash
skillmd use <skill-id> [--version <semver> | --channel <latest|beta>] [--allow-yanked] [--json]
```

### `skillmd update`

Update installed skills in the current project.

```bash
skillmd update [skill-id ...] [--all] [--allow-yanked] [--json]
```

- `skillmd update` and `skillmd update --all` do the same thing

## License

MIT
