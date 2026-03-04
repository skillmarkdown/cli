# Testing `skillmd`

This guide shows how to test `@skillmarkdown/cli` locally.

## Prerequisites

- Node.js 18+
- npm

## 1) Install dependencies

```bash
npm install
npm run build
```

## 2) Run automated tests

```bash
npm test
```

This runs:

- TypeScript build (`npm run build`)
- Node built-in test suite (`node --test`)
- Spawned-binary CLI integration tests (`tests/integration/cli-integration.test.js`)

## Pre-commit hooks

Git pre-commit now runs through Husky + lint-staged:

- ESLint + Prettier on staged `*.ts` and `*.js`
- Prettier on staged `*.json`, `*.mjs`, `*.md`, `*.yml`, and `*.yaml`

## CI and smoke scripts

- `npm run ci:check` runs format check, lint, tests, and pack size budget enforcement.
- `npm run check:src-loc` enforces `src` estimated code-line budget (`<= 9,200`).
- `npm run check:pack-size` enforces npm unpacked size budget (`<= 130,000` bytes).
- `npm run smoke:pack` builds, packs, installs the tarball, and runs init/validate from the packed install.
- `npm run smoke:link` (optional) runs an install-level check via `npm link`.

## 3) Manual smoke test (success path)

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/my-skill"
cd "$tmpdir/my-skill"
node "$REPO_DIR/dist/cli.js" init
find . -type f | sort
```

Expected files:

- `./SKILL.md`

Expected `SKILL.md`:

- valid YAML frontmatter with required fields
- template guidance for optional spec fields (`compatibility`, `metadata`, `allowed-tools`, `license`)
- strict guidance sections (`## Scope`, `## When to use`, etc.)

Expected CLI output includes:

- initialization success line
- spec validation result line (`Validation passed: Spec validation passed.`)

### Full verbose template smoke

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/my-skill-verbose"
cd "$tmpdir/my-skill-verbose"
node "$REPO_DIR/dist/cli.js" init --template verbose
find . -type f | sort
```

Expected files:

- `./SKILL.md`
- `./.gitignore`
- `./LICENSE`
- `./scripts/.gitkeep`
- `./scripts/README.md`
- `./scripts/extract.py`
- `./references/.gitkeep`
- `./references/REFERENCE.md`
- `./references/FORMS.md`
- `./assets/.gitkeep`
- `./assets/README.md`
- `./assets/report-template.md`
- `./assets/lookup-table.csv`

Expected CLI output includes strict template validation:

- `Validation passed: Spec and strict scaffold validation passed.`

## 4) Manual smoke test (error path)

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/non-empty-skill"
touch "$tmpdir/non-empty-skill/existing.txt"
cd "$tmpdir/non-empty-skill"
node "$REPO_DIR/dist/cli.js" init
echo $?
```

Expected:

- clear error about non-empty directory
- exit code `1`

## 5) Determinism check

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/deterministic-skill-a" "$tmpdir/deterministic-skill-b"

for d in "$tmpdir/deterministic-skill-a" "$tmpdir/deterministic-skill-b"; do
  (cd "$d" && node "$REPO_DIR/dist/cli.js" init)
done

diff -ru "$tmpdir/deterministic-skill-a" "$tmpdir/deterministic-skill-b"
```

Expected:

- no diff output

## 6) Run local validation command

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/validate-skill"
(cd "$tmpdir/validate-skill" && node "$REPO_DIR/dist/cli.js" init)
(cd "$tmpdir/validate-skill" && node "$REPO_DIR/dist/cli.js" validate)
```

Expected:

- `Validation passed: Spec validation passed.`
- exit code `0`
- only spec-focused checks are applied in this mode (`SKILL.md` + frontmatter rules)
- scaffold/template conventions are not required unless `--strict` is used

### Strict mode

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/validate-strict-skill"
(cd "$tmpdir/validate-strict-skill" && node "$REPO_DIR/dist/cli.js" init --template verbose --no-validate)
(cd "$tmpdir/validate-strict-skill" && node "$REPO_DIR/dist/cli.js" validate --strict)
```

Expected:

- `Validation passed: Spec and strict scaffold validation passed.`
- strict mode adds scaffold/template checks on top of base spec validation

## 7) Optional init without validation

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/no-validate-skill"
(cd "$tmpdir/no-validate-skill" && node "$REPO_DIR/dist/cli.js" init --no-validate)
```

Expected:

- initialization succeeds
- CLI prints `Validation skipped (--no-validate).`

## 8) Optional verifier check (`skills-ref`)

After generating a skill directory:

```bash
skills-ref validate /path/to/generated-skill
```

Use this as an external conformance check against AgentSkills rules.

### Parity check mode

If `skills-ref` is installed, compare local validator status against it:

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/parity-skill"
(cd "$tmpdir/parity-skill" && node "$REPO_DIR/dist/cli.js" init --no-validate)
(cd "$tmpdir/parity-skill" && node "$REPO_DIR/dist/cli.js" validate --parity)
```

Expected:

- `Validation parity passed (skills-ref).`

## 9) Manual auth test (`skillmd login`)

Prerequisites:

- GitHub OAuth app is configured with Device Flow enabled.
- Firebase Authentication GitHub provider is enabled with the same GitHub OAuth app credentials.
- Optional: you know override values for:
  - `SKILLMD_GITHUB_CLIENT_ID`
  - `SKILLMD_FIREBASE_API_KEY`
  - `SKILLMD_FIREBASE_PROJECT_ID`

The command works with built-in defaults. If you want to override, either set env vars:

```bash
export SKILLMD_GITHUB_CLIENT_ID="your_github_oauth_client_id"
export SKILLMD_FIREBASE_API_KEY="your_firebase_web_api_key"
export SKILLMD_FIREBASE_PROJECT_ID="your_firebase_project_id"
```

Or create a trusted user config file:

```bash
mkdir -p ~/.skillmd
cat > ~/.skillmd/.env <<'EOF'
SKILLMD_GITHUB_CLIENT_ID=your_github_oauth_client_id
SKILLMD_FIREBASE_API_KEY=your_firebase_web_api_key
SKILLMD_FIREBASE_PROJECT_ID=your_firebase_project_id
EOF
```

Run login:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" login
```

Expected:

- CLI prints a GitHub verification URL and user code.
- After approving in browser, CLI prints `Login successful` (and email when available).
- Session file exists at `~/.skillmd/auth.json`.
- if a stale saved session exists, `login` should automatically start reauthentication.

Check login status:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" login --status
```

Expected:

- `Logged in with GitHub ... (project: ...)`
- exit code `0`

Force reauthentication:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" login --reauth
```

Expected:

- command starts a fresh device flow even if already logged in
- successful completion overwrites `~/.skillmd/auth.json` with the new session

Logout:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" logout
node "$REPO_DIR/dist/cli.js" login --status
```

Expected:

- first command prints `Logged out.`
- second command prints `Not logged in.`
- status returns exit code `1` when logged out

Negative-path checks:

```bash
REPO_DIR="$(pwd)"
SKILLMD_GITHUB_CLIENT_ID="" SKILLMD_FIREBASE_API_KEY="" node "$REPO_DIR/dist/cli.js" login
node "$REPO_DIR/dist/cli.js" login --bad-flag
```

Expected:

- blank env vars: command falls back to the next configured source (`~/.skillmd/.env` or built-in defaults) and continues login flow
- unsupported flag: usage line `Usage: skillmd login [--status|--reauth]`
- if session verification cannot complete (e.g. timeout), `login` should keep the current session and return a non-zero exit code

## 10) Manual publish dry-run test (`skillmd publish`)

Prerequisites:

- You have a logged-in session (`skillmd login`) in the same shell/user context.
- You have a valid verbose scaffold skill directory.

Generate a verbose skill and run dry-run publish:

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/publish-skill"
(cd "$tmpdir/publish-skill" && node "$REPO_DIR/dist/cli.js" init --template verbose --no-validate)
(cd "$tmpdir/publish-skill" && node "$REPO_DIR/dist/cli.js" publish --version 1.0.0 --dry-run)
(cd "$tmpdir/publish-skill" && node "$REPO_DIR/dist/cli.js" publish --version 1.0.1 --access private --dry-run)
```

Expected:

- strict validation is executed and passes.
- CLI prints a dry-run summary with:
  - `@owner/skill@version`
  - tag (`latest` by default)
  - access (`public` by default, `private` when explicitly set)
  - digest (`sha256:...`)
  - artifact size bytes

JSON output shape check:

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/publish-skill-json"
(cd "$tmpdir/publish-skill-json" && node "$REPO_DIR/dist/cli.js" init --template verbose --no-validate)
(cd "$tmpdir/publish-skill-json" && node "$REPO_DIR/dist/cli.js" publish --version 1.2.3-beta.1 --dry-run --json)
```

Expected:

- valid JSON object with `status: \"dry-run\"`
- `tag: \"latest\"` by default
- `access: \"public\"` by default

Project mismatch path:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" publish --version 1.0.0 --dry-run
```

Expected when session/config projects differ:

- non-zero exit
- guidance to run `skillmd login --reauth`

## 11) Manual discovery output smoke (`search` and `history`)

Use development registry:

```bash
REPO_DIR="$(pwd)"
export SKILLMD_FIREBASE_PROJECT_ID="skillmarkdown-development"
export SKILLMD_REGISTRY_BASE_URL="https://registryapi-sm46rm3rja-uc.a.run.app"
node "$REPO_DIR/dist/cli.js" search --limit 5
node "$REPO_DIR/dist/cli.js" search --scope private --limit 5
```

Expected:

- output starts with a boxed table:
  - top border begins with `┌`
  - header row contains `#`, `SKILL`, `LATEST`, `UPDATED`, `DESCRIPTION`
- row columns remain aligned
- next page hint prints when cursor exists
- private scope requires login and only returns caller-owned private skills

Search pagination:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" search agent --limit 5 --cursor "<token>"
```

Expected:

- page returns successfully with the same header format
- `#` numbering continues from previous page (does not reset to `1`)

History output:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" history @owner/skill --limit 5
```

Expected:

- output starts with a boxed table:
  - top border begins with `┌`
  - header row contains `VERSION`, `PUBLISHED`, `DEPRECATED`, `SIZE`, `DIGEST`, `MEDIA`
- digest is shortened in human mode (`sha256:<prefix>...`)
- deprecated rows show `yes:<reason>` in `DEPRECATED`
- next page hint prints when cursor exists

History pagination:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" history @owner/skill --limit 5 --cursor "<token>"
```

Expected:

- page returns successfully with same column layout

## 12) Manual skill detail smoke (`view`)

```bash
REPO_DIR="$(pwd)"
export SKILLMD_FIREBASE_PROJECT_ID="skillmarkdown-development"
export SKILLMD_REGISTRY_BASE_URL="https://registryapi-sm46rm3rja-uc.a.run.app"
node "$REPO_DIR/dist/cli.js" view @owner/skill
node "$REPO_DIR/dist/cli.js" view 1
```

Expected:

- output includes:
  - `Skill: @owner/skill`
  - `Owner: ...`
  - `Updated: ...`
  - `Access: ...`
  - `Dist tags:` with at least `latest` when present
- `view <n>` resolves from the visible `#` column on the latest `search` page in the same registry environment

JSON mode:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" view @owner/skill --json
```

Expected:

- valid JSON payload with owner/skill/description/access/distTags/updatedAt fields.

## 13) Manual installed-skill refresh smoke (`update`)

Install/update in development environment:

```bash
REPO_DIR="$(pwd)"
export SKILLMD_FIREBASE_PROJECT_ID="skillmarkdown-development"
export SKILLMD_REGISTRY_BASE_URL="https://registryapi-sm46rm3rja-uc.a.run.app"
node "$REPO_DIR/dist/cli.js" update --all
```

Expected:

- command scans selected target root (default `.agent/skills/registry.skillmarkdown.com/*/*`)
- output table has `SKILL`, `FROM`, `TO`, `STATUS`, `DETAIL`
- summary line reports total/updated/skipped/failed counts

Targeted update by skill id:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" update @owner/skill-a @owner/skill-b
```

Expected:

- only listed skills are processed
- missing local installs are reported as failed entries
- command continues through all entries and exits non-zero only if any failures occurred

JSON mode:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/dist/cli.js" update --all --json
```

Expected:

- valid JSON payload with `mode`, `total`, `updated[]`, `skipped[]`, `failed[]`
- version-pinned installs appear in `skipped[]` with `status: \"skipped_pinned\"`

## 14) Replayable full command sweep (dev + prod)

Use the replayable script for frequent end-to-end sweeps:

```bash
REPO_DIR="$(pwd)"
npm run sweep:commands:dev
npm run sweep:commands:prod
```

Or run directly with custom options:

```bash
REPO_DIR="$(pwd)"
node "$REPO_DIR/scripts/command-sweep.mjs" --env both --allow-auth-blocked --report-file /tmp/skillmd-sweep.json
```

Options:

- `--env dev|prod|both`: choose profile(s).
- `--write`: include write commands (`publish` real + `tag add/rm` + `deprecate` + `unpublish`).
- `--allow-auth-blocked`: treat auth-blocked steps as non-fatal.
- `--report-file <path>`: write full machine-readable JSON report.
- `--keep-workspace`: keep temp workspace for postmortem.

Environment notes:

- Dev write flows need a valid dev web API key: set `SKILLMD_DEV_FIREBASE_API_KEY`.
- Prod profile uses `skillmarkdown` project and `https://registry.skillmarkdown.com`.

Exit code contract:

- `0`: no failures (auth-blocked steps allowed only with `--allow-auth-blocked`).
- `2`: one or more hard command failures.
- `3`: blocked auth steps encountered without `--allow-auth-blocked`.

## 15) Workspace install smoke (`install`)

Install dependencies from `skills.json` and confirm lockfile writes:

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
cd "$tmpdir"

cat > skills.json <<'EOF'
{
  "version": 1,
  "defaults": {
    "agentTarget": "skillmd"
  },
  "dependencies": {
    "@owner/skill-a": {
      "spec": "latest"
    }
  }
}
EOF

node "$REPO_DIR/dist/cli.js" install --json
```

Expected:

- command resolves/install dependencies declared in `skills.json`
- `skills-lock.json` is created or updated
- JSON output contains `total`, `installed[]`, `skipped[]`, `failed[]` (and `pruned[]` when `--prune` is used)
