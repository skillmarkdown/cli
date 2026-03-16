# skillmarkdown

[![npm version](https://img.shields.io/npm/v/skillmarkdown)](https://www.npmjs.com/package/skillmarkdown)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

npm-like lifecycle for agent skills: create, publish, install, tag, deprecate, and unpublish.

## Why skillmd

- Publish and manage versioned agent skills.
- Install directly or from a workspace `skills.json`.
- Support built-in agent targets plus `custom:<slug>`.

## Install

```bash
npm i -g skillmarkdown
```

Or run one-off commands with:

```bash
npx skillmarkdown <command>
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
skillmd view @username/my-skill
skillmd history @username/my-skill

# 4) Consume and maintain installs
skillmd use @username/my-skill
skillmd use -g @your-org/internal-skill
skillmd list
skillmd remove @username/my-skill
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
    "@username/research-skill": {
      "spec": "latest",
      "agentTarget": "claude"
    },
    "@username/ops-skill": {
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
- Use `skillmd use -g <skill-id>` for global installs, which is useful for internal/shared skills outside a single workspace.
- For the default `skillmd` target, global installs go under `~/.agent/skills/<skill>`.
- The CLI still keeps auth/session/config and the global lockfile under `~/.skillmd/...`; that is metadata, not the installed skill location.

## Authentication

`skillmd login` signs you in to your Skillmarkdown account so the CLI can publish skills, manage installs, and access private or organization-scoped features.

For API-calling commands, auth precedence is:

| Priority | Source            | Example                                                |
| -------- | ----------------- | ------------------------------------------------------ |
| 1        | CLI flag          | `skillmd --auth-token <token> publish --version 1.2.3` |
| 2        | Environment       | `export SKILLMD_AUTH_TOKEN=<token>`                    |
| 3        | Signed-in session | `skillmd login`                                        |

Token scope model:

- `read`: read endpoints
- `publish`: read + publish/tag writes
- `admin`: publish + lifecycle + token management

Organization automation:

- you can manage organization access tokens from the CLI or from the Skillmarkdown web app
- use them for organization-owned automation with an explicit owner target, for example:

```bash
skillmd org tokens add facebook deploy --scope admin
SKILLMD_AUTH_TOKEN=skmd_dev_tok_... skillmd publish --owner facebook --version 1.2.3
```

## Commands

- Authoring: `init`, `validate`, `publish`
- Discovery: `search`, `view`, `history`
- Consumption: `use`, `install`, `list`, `remove`, `update`
- Release: `tag`, `deprecate`, `unpublish`
- Auth and org: `login`, `logout`, `whoami`, `token`, `org`

## Accounts And Tokens

- Use `skillmd login` when you want to work as yourself from the CLI.
- Use `skillmd token` to create personal access tokens for scripts and automation.
- Use `skillmd org tokens` when automation should act on behalf of an organization instead of an individual account.

## Support

- Security policy: [SECURITY.md](SECURITY.md)
- Issues: [GitHub Issues](https://github.com/skillmarkdown/cli/issues)

## Release Validation

Release-gate commands:

```bash
npm run e2e:contract
npm run e2e:core
npm run e2e:extended
npm run e2e:release
```

Exploratory sweeps:

```bash
npm run sweep:commands:dev
npm run sweep:commands:dev:extended
```

## License

MIT
