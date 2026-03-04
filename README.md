# @skillmarkdown/cli

[![CI](https://github.com/skillmarkdown/cli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/skillmarkdown/cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40skillmarkdown%2Fcli)](https://www.npmjs.com/package/@skillmarkdown/cli)
[![npm downloads](https://img.shields.io/npm/dm/%40skillmarkdown%2Fcli)](https://www.npmjs.com/package/@skillmarkdown/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

npm-like lifecycle for agent skills: create, publish, install, tag, deprecate, and unpublish.

![skillmd CLI command sweep demo](public/assets/images/cli-readme-sweep.png)

_Real command-sweep output from the CLI test flow._

## Why skillmd

- Strict v1 registry contracts (`tag`, `access`, `spec`, `distTags`, lifecycle metadata).
- Workspace runtime model with `skills.json` intent + `skills-lock.json` resolved state.
- Agent-targeted installs for `skillmd`, `claude`, `gemini`, and `custom:<slug>`.
- Release operations in one CLI: dist-tags, deprecation, and policy-gated unpublish.
- Automation-friendly auth with scoped tokens (`read`, `publish`, `admin`).

## Install

```bash
npm i -g @skillmarkdown/cli
```

Or run one-off commands with:

```bash
npx @skillmarkdown/cli <command>
```

## Quickstart (60 seconds)

```bash
# 1) Author a new skill
mkdir my-skill && cd my-skill
skillmd init --template minimal
skillmd validate --strict

# 2) Authenticate and publish
skillmd login
skillmd publish --version 1.0.0 --tag latest --access public

# 3) Discover and inspect
skillmd search
skillmd view @owner/my-skill
skillmd history @owner/my-skill

# 4) Consume and maintain installs
skillmd use @owner/my-skill
skillmd update --all
```

## Workspace install (`skills.json`)

Use `skillmd install` for declarative, workspace-level installs.

```json
{
  "version": 1,
  "defaults": {
    "agentTarget": "skillmd"
  },
  "dependencies": {
    "@owner/research-skill": {
      "spec": "latest",
      "agentTarget": "claude"
    },
    "@owner/ops-skill": {
      "spec": "^1.2.0"
    }
  }
}
```

```bash
# Install all declared dependencies
skillmd install

# Remove undeclared lock/install entries
skillmd install --prune
```

Notes:

- `skills.json` is the declared intent.
- `skills-lock.json` is CLI-owned resolved state, rewritten after successful installs/updates.
- `skillmd use` remains available for one-off installs outside manifest flow.

## Authentication modes

For API-calling commands, auth precedence is:

| Priority | Source              | Example                                                |
| -------- | ------------------- | ------------------------------------------------------ |
| 1        | CLI flag            | `skillmd --auth-token <token> publish --version 1.2.3` |
| 2        | Environment         | `export SKILLMD_AUTH_TOKEN=<token>`                    |
| 3        | Interactive session | `skillmd login`                                        |

Token scope model:

- `read`: read endpoints
- `publish`: read + publish/tag writes
- `admin`: publish + lifecycle + token management

## Command map (by outcome)

### Authoring

- `skillmd init [--template <minimal|verbose>] [--no-validate]`
- `skillmd validate [path] [--strict] [--parity]`
- `skillmd publish [path] --version <semver> [--tag <dist-tag>] [--access <public|private>] [--provenance] [--agent-target <target>] [--dry-run] [--json]`

### Discovery

- `skillmd search [query] [--limit <1-50>] [--cursor <token>] [--scope <public|private>] [--json]`
- `skillmd view <skill-id|index> [--json]`
- `skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]`

### Consumption

- `skillmd use <skill-id> [--version <semver> | --spec <tag|version|range>] [--agent-target <target>] [--json]`
- `skillmd install [--prune] [--agent-target <target>] [--json]`
- `skillmd update [skill-id ...] [--all] [--agent-target <target>] [--json]`

### Release operations

- `skillmd tag ls <skill-id> [--json]`
- `skillmd tag add <skill-id>@<version> <tag> [--json]`
- `skillmd tag rm <skill-id> <tag> [--json]`
- `skillmd deprecate <skill-id>@<version|range> --message "<text>" [--json]`
- `skillmd unpublish <skill-id>@<version> [--json]`

### Auth operations

- `skillmd whoami [--json]`
- `skillmd token ls [--json]`
- `skillmd token add <name> [--scope <read|publish|admin>] [--days <1-365>] [--json]`
- `skillmd token rm <token-id> [--json]`

## Troubleshooting

### Session project mismatch

Symptom:

```text
session project 'skillmarkdown' does not match current config 'skillmarkdown-development'
```

Fix:

```bash
skillmd login --reauth
```

### Scope errors with automation token

Symptom: `unauthorized` or `forbidden` on write commands.

Fix: create/use a token with required scope (`publish` or `admin`) and pass it via `--auth-token` or `SKILLMD_AUTH_TOKEN`.

### Invalid lockfile schema

Symptom: install/update fails due to malformed `skills-lock.json`.

Fix: correct schema or remove file and reinstall from `skills.json`:

```bash
rm -f skills-lock.json
skillmd install
```

### `not_found` on `use`/`tag` resolution

Symptom: version/tag pointer cannot be resolved.

Fix:

```bash
skillmd view @owner/skill
skillmd history @owner/skill
skillmd tag ls @owner/skill
```

Then retry with explicit selector, for example `--spec 1.2.3` or `--spec beta`.

## Support and project health

- Support: [SUPPORT.md](SUPPORT.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## More docs

- Publish API: [docs/publish-api.md](docs/publish-api.md)
- Publish registry model: [docs/publish-registry.md](docs/publish-registry.md)
- CLI architecture: [docs/architecture.md](docs/architecture.md)
- Testing strategy: [docs/testing.md](docs/testing.md)
- Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)

## License

MIT
