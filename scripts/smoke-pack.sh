#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

npm run clean
npm run build

PACK_FILE="$(npm pack --silent)"
TMP_DIR="$(mktemp -d)"
INSTALL_DIR="$TMP_DIR/install"
SKILL_DIR="$TMP_DIR/packed-skill"
PACKAGE_CLI_PATH="$INSTALL_DIR/node_modules/@skillmarkdown/cli/dist/cli.js"

cleanup() {
  rm -rf "$TMP_DIR"
  rm -f "$REPO_ROOT/$PACK_FILE"
}
trap cleanup EXIT

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
npm init -y >/dev/null 2>&1
npm install "$REPO_ROOT/$PACK_FILE" >/dev/null

mkdir -p "$SKILL_DIR"
cd "$SKILL_DIR"
node "$PACKAGE_CLI_PATH" init --template verbose
node "$PACKAGE_CLI_PATH" validate
node "$PACKAGE_CLI_PATH" validate --strict

echo "Packed tarball smoke check passed."
