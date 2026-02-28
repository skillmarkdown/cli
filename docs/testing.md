# Testing `skillmd init`

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
- Node built-in test suite (`node --test tests/*.test.js`)
- Spawned-binary CLI integration tests (`tests/cli-integration.test.js`)

## Pre-commit hooks

Git pre-commit now runs through Husky + lint-staged:

- ESLint + Prettier on staged `*.ts` and `*.js`
- Prettier on staged `*.json`, `*.mjs`, `*.md`, `*.yml`, and `*.yaml`

## CI and smoke scripts

- `npm run ci:check` runs format check, lint, and tests.
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
- `./.gitignore`
- `./scripts/.gitkeep`
- `./references/.gitkeep`
- `./assets/.gitkeep`

Expected CLI output includes:

- initialization success line
- strict validation result line (`Validation passed: Spec and strict scaffold validation passed.`)

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

### Strict mode

```bash
REPO_DIR="$(pwd)"
tmpdir="$(mktemp -d)"
mkdir "$tmpdir/validate-strict-skill"
(cd "$tmpdir/validate-strict-skill" && node "$REPO_DIR/dist/cli.js" init --no-validate)
(cd "$tmpdir/validate-strict-skill" && node "$REPO_DIR/dist/cli.js" validate --strict)
```

Expected:

- `Validation passed: Spec and strict scaffold validation passed.`

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
