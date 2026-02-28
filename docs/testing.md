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

## 6) Optional verifier check (`skills-ref`)

After generating a skill directory:

```bash
skills-ref validate /path/to/generated-skill
```

Use this as an external conformance check against AgentSkills rules.
