# CLI Architecture (Deep Dive)

This document describes how `@skillmarkdown/cli` is structured today, how command flows are composed, and where extension points and maintenance risks exist.

## Scope and Runtime

- Package: `@skillmarkdown/cli`
- Runtime: Node.js `>=18`
- Build: TypeScript (`src/**/*.ts`) -> CommonJS output (`dist/`)
- Entrypoint: `src/cli.ts`
- Public binary: `skillmd`

## Command Dispatch Model

Command routing is explicit and centralized in `src/cli.ts`.

- `COMMAND_HANDLERS` maps command strings to `run*Command` functions.
- Unknown commands and missing command invocation produce root usage from `src/lib/shared/cli-text.ts`.
- Command handlers return numeric exit codes (`0` success, `1` failure).

Current command surface:

- `init`
- `validate`
- `login`
- `logout`
- `publish`
- `search`
- `view`
- `history`
- `install`
- `use`
- `update`
- `tag`
- `deprecate`
- `unpublish`

## Module Boundaries

### `src/commands/*`

Each command module is responsible for:

- argument parsing via a command-specific flags parser,
- wiring env/config and dependencies,
- orchestration of command flow,
- user-facing output formatting,
- standardized error-to-exit-code conversion.

### `src/lib/*`

Library modules are grouped by domain:

- `auth`: session read/write, GitHub device flow, Firebase token exchange, read-token resolution.
- `publish`: publish request flags, API client, deterministic packing, manifest mapping.
- `search` / `view` / `history`: read-side flag parsing, HTTP client behavior, command-specific payload contracts.
- `use`: resolve/artifact/download APIs, integrity validation, install workflow, install pathing.
- `update`: installed skill discovery, metadata parsing, update intent resolution.
- `validation`: local `SKILL.md` quality checks.
- `shared`: common text, table rendering, HTTP timeout wrapper, command output helpers, shared API parsing helpers.
- `registry`: registry environment resolution and base URL mapping.

### Shared utility boundaries

Recent consolidation reduced repeated code in per-command clients:

- `src/lib/shared/api-client.ts`: JSON parsing + error envelope extraction + auth header builder.
- `src/lib/auth/read-token-retry.ts`: single retry wrapper used by view/history/use flows.
- `src/lib/registry/config.ts`: common registry host + timeout resolution.

## Auth and Session Lifecycle

Authentication is user-local and file-backed.

1. `skillmd login`

- Starts GitHub device flow.
- Exchanges GitHub access token for Firebase refresh token and profile.
- Persists session to user scope (`~/.skillmd`).

2. Session usage in read/write flows

- `publish` requires authenticated token.
- Private read flows use `resolveReadIdToken` to exchange stored refresh token for short-lived ID token.
- Public read flows do not require token.

3. Project safety

- Session/project mismatch is detected and treated as unauthenticated in read-token resolution.

## Read-Token Retry Behavior

Read commands intentionally attempt anonymous-first in selected cases to keep public flows fast while still enabling private-owner reads.

- Retry utility: `callWithReadTokenRetry`.
- Retry statuses: `401`, `403`, `404` (context-specific via command-level guard).
- Retry policy:
  - first request runs with current token state,
  - on retryable failure and no token, resolve token once,
  - retry exactly once with resolved token,
  - if token resolve fails or returns null, rethrow original API error.

This behavior is validated by `tests/auth/read-token-retry.test.js`.

## Install Lifecycle (`install` and `use`)

Primary orchestrator: `src/lib/use/workflow.ts`.

1. Parse and normalize skill ID.
2. Resolve target version from selector:

- `use --version <semver>` installs exact version,
- `use --spec <tag|version|range>` resolves against `/resolve?spec=...`,
- `use` default selector is `latest`,
- `install` reads selector `spec` from `skills.json` dependency entries.

3. Request artifact descriptor from backend (includes digest, size, media type, signed URL).
4. Download artifact bytes.
5. Verify integrity:

- byte size match,
- digest match (`sha256`),
- media-type expectation.

6. Install atomically through `src/lib/use/install.ts`:

- extract to temp run dir,
- enforce extracted payload shape (`SKILL.md` at archive root, regular file, not symlink),
- backup old target (if present),
- swap new target into place,
- restore old target on swap failure (best effort).

7. Persist workspace install state to `skills-lock.json`:

- `use` upserts a single lock entry for installed skill/target/registry host,
- `install` upserts all manifest-declared dependencies,
- `update` consumes lock entries only.

Install destination in v1:

- `skillmd`: `<cwd>/.agent/skills/registry.skillmarkdown.com/<owner>/<skill>`
- `claude`: `<cwd>/.claude/skills/registry.skillmarkdown.com/<owner>/<skill>`
- `gemini`: `<cwd>/.gemini/skills/registry.skillmarkdown.com/<owner>/<skill>`
- `custom:<slug>`: `<cwd>/.agents/skills/<slug>/registry.skillmarkdown.com/<owner>/<skill>`

The install host is intentionally canonicalized to `registry.skillmarkdown.com` for stable local paths.

## Update Lifecycle

Primary orchestrator: `src/commands/update.ts`.

Modes:

- `update` or `update --all`: process all matching entries from `skills-lock.json`.
- `update <ids...>`: update only explicit IDs present in lockfile.

Selector behavior:

- if lock `selectorSpec` is exact semver, skip (pinned),
- otherwise resolve using stored selector spec (`latest`, tag, or semver range).

Batch behavior:

- continue on per-skill failure,
- print per-skill status,
- non-zero exit if any failed.

## Config Resolution Precedence

Auth and registry config are resolved in layered order.

1. Process environment (`SKILLMD_*`).
2. Trusted user env file (`~/.skillmd/.env`).
3. Built-in defaults (for login auth + project defaults).

Registry base URL resolution:

- explicit `SKILLMD_REGISTRY_BASE_URL`, else
- project map in `src/lib/registry/config.ts`.

Agent target default resolution:

- explicit `--agent-target` per command, else
- backend descriptor `agentTarget` (for `use`), else
- `SKILLMD_AGENT_TARGET`, else
- `skillmd`.

Timeout default:

- `SKILLMD_REGISTRY_TIMEOUT_MS` or fallback `10000` ms.

## Output and Error Contracts

### Human output

- concise status lines for success/failure,
- table output for discovery/history/update where helpful,
- next-page hints for cursor-based paging.

### JSON mode

- `--json` prints raw structured payload for automation.

### Error handling

- API client layers map backend envelope into typed command-domain errors.
- command layers render stable UX text plus `(code, status)` where available.
- unexpected errors are surfaced with generic fallback message and exit code `1`.

## Extension Guide: Adding a New Command

1. Add command module under `src/commands/<name>.ts` exporting `run<Name>Command`.
2. Add parser/types/client modules under `src/lib/<name>/`.
3. Register handler in `src/cli.ts`.
4. Add usage string in `src/lib/shared/cli-text.ts`.
5. Add command tests:

- flags parser unit tests,
- client behavior tests,
- command output/error tests,
- integration smoke in `tests/integration/cli-integration.test.js` when needed.

6. Update docs:

- `README.md`,
- `docs/testing.md`,
- contract note if backend API involved.

## Current Hotspots to Watch

- Large command orchestrators (`search`, `update`) combine parsing/orchestration/rendering responsibilities.
- Shared read retry behavior must remain consistent with backend private/public semantics.
- Workspace contract evolution (`skills.json` intent vs `skills-lock.json` resolved state) must remain deterministic.
