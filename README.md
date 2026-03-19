# skillmarkdown

[![npm version](https://img.shields.io/npm/v/skillmarkdown)](https://www.npmjs.com/package/skillmarkdown)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

npm-like lifecycle for agent skills: create, publish, install, tag, deprecate, and unpublish.

## Why skillmd

- Create and publish versioned skills.
- Search, inspect, and install skills quickly.
- Work with personal skills like `my-skill` and org skills like `@acme/my-skill`.
- Personal skills are always bare. Scoped ids are reserved for organizations only.

## Install

```bash
npm i -g skillmarkdown
```

Or run one-off commands with:

```bash
npx skillmarkdown <command>
```

## Quickstart

```bash
# Initialize the current directory as a skill
mkdir my-skill && cd my-skill
skillmd init --template minimal
skillmd validate --strict

# Or create a new skill directory in one step
skillmd create another-skill --template minimal

# Sign in and publish it
skillmd login
skillmd publish --version 1.0.0 --tag latest --access public

# Find and inspect skills
skillmd search
skillmd view my-skill
skillmd history my-skill

# Use and maintain installs
skillmd use my-skill
skillmd use -g @acme/internal-skill
skillmd list
skillmd remove my-skill
skillmd update --all
```

## Workspace install (`skills.json`)

Use `skillmd install` when your workspace should declare the skills it needs.

```json
{
  "version": 1,
  "defaults": {
    "agentTarget": "skillmd"
  },
  "dependencies": {
    "research-skill": {
      "spec": "latest",
      "agentTarget": "claude"
    },
    "@acme/ops-skill": {
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

- `skills.json` is the list you want.
- `skills-lock.json` is the resolved list the CLI writes after install or update.
- `skillmd use` is still the simplest way to install one skill directly.
- `skillmd use -g <skill-id>` installs to a provider home instead of the current workspace.

## Authentication

`skillmd login` signs you in so the CLI can publish skills, manage installs, and access private or org features.

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

- create org tokens from the CLI or the web app
- use them when automation should publish on behalf of an org:

```bash
skillmd org tokens add acme deploy --scope admin
SKILLMD_AUTH_TOKEN=skmd_dev_tok_... skillmd publish --owner acme --version 1.2.3
```

## Commands

- Create and check: `init`, `create`, `validate`
- Publish and release: `publish`, `tag`, `deprecate`, `unpublish`
- Find and inspect: `search`, `view`, `history`
- Install and maintain: `use`, `install`, `list`, `remove`, `update`
- Account and access: `login`, `logout`, `whoami`, `token`, `org`

## Organizations

Use org commands when a team owns the skill instead of one person.

```bash
skillmd org create acme
skillmd publish --owner acme --version 1.0.0
skillmd use @acme/internal-skill
```

## Accounts And Tokens

- Use `skillmd login` when you want to work as yourself from the CLI.
- Use `skillmd token` to create personal access tokens for scripts and automation.
- Use `skillmd org tokens` when automation should act as an organization instead of an individual account.

## Troubleshooting

- If `publish`, `install`, `search`, or `view` says you are not logged in, run `skillmd login`.
- If `publish` or `use` is blocked by plan or account access, visit [skillmarkdown.com](https://www.skillmarkdown.com).
- If a new skill fails validation, run `skillmd validate --strict` in the skill directory and fix the reported issues before publishing.
- If you want to start a new skill in the current directory, use `skillmd init`. If you want the CLI to create the directory for you, use `skillmd create <target>`.

## Support

- Security policy: [SECURITY.md](SECURITY.md)
- Website: [skillmarkdown.com](https://www.skillmarkdown.com)
- Issues: [GitHub Issues](https://github.com/skillmarkdown/cli/issues)

## License

MIT
