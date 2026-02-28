#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

npm run clean
npm run build
npm link >/dev/null

TMP_DIR="$(mktemp -d)"
SKILL_DIR="$TMP_DIR/linked-skill"

cleanup() {
  rm -rf "$TMP_DIR"
  npm unlink -g @skillmarkdown/cli >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "$SKILL_DIR"
cd "$SKILL_DIR"
skillmd init --no-validate
skillmd validate
skillmd validate --strict

echo "npm link smoke check passed."
