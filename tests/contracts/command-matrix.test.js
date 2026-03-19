const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadMatrix() {
  const modulePath = pathToFileURL(path.join(process.cwd(), "scripts", "command-matrix.mjs")).href;
  return import(modulePath);
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("command matrix covers every shipped top-level command handler", async () => {
  const { getMatrixCommands } = await loadMatrix();
  const cliSource = readFile("src/cli.ts");
  const handlerBlock = cliSource.match(/const COMMAND_HANDLERS:[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  assert.ok(handlerBlock, "could not locate command handlers");
  const handlers = Array.from(handlerBlock[1].matchAll(/^\s*([a-z]+):/gm)).map((match) => match[1]);
  const matrixCommands = getMatrixCommands();

  for (const command of handlers) {
    assert.ok(matrixCommands.has(command), `command matrix missing top-level command '${command}'`);
  }
});

test("command matrix covers documented usage variants", async () => {
  const { getMatrixIds } = await loadMatrix();
  const ids = getMatrixIds();
  const requiredIds = [
    "root.no-command",
    "root.unknown-command",
    "root.version.long",
    "root.version.short",
    "root.auth-token.global",
    "create.minimal",
    "init.minimal",
    "init.verbose",
    "init.verbose.no-validate",
    "validate.default",
    "validate.strict",
    "validate.parity",
    "login.status",
    "login.reauth",
    "login.env-noninteractive",
    "login.env-missing",
    "logout.basic",
    "publish.dry-run",
    "publish.real",
    "publish.owner",
    "publish.access.private",
    "publish.provenance",
    "search.limit",
    "search.cursor",
    "search.scope.public",
    "search.scope.private",
    "view.skill-id",
    "view.selection-index",
    "history.limit",
    "history.cursor",
    "install.prune",
    "list.global",
    "remove.global",
    "use.save",
    "use.global",
    "use.save-global-conflict",
    "update.all",
    "update.global",
    "tag.ls",
    "tag.add",
    "tag.rm",
    "deprecate.version",
    "deprecate.range",
    "unpublish.version",
    "token.add.read",
    "token.add.publish",
    "token.add.admin",
    "token.invalid-id",
    "org.ls",
    "org.members.add",
    "org.team.add",
    "org.team.members.rm",
    "org.skills.team.set",
    "org.skills.team.clear",
    "org.tokens.ls",
    "org.tokens.add",
    "org.tokens.rm",
  ];

  for (const id of requiredIds) {
    assert.ok(ids.has(id), `command matrix missing required scenario '${id}'`);
  }
});

test("documented org token usage is present in help text", () => {
  const cliText = readFile("src/lib/shared/cli-text.ts");
  assert.match(cliText, /skillmd org tokens ls <org>/);
  assert.match(cliText, /skillmd org tokens add <org> <name>/);
  assert.match(cliText, /skillmd org tokens rm <org> <token-id>/);
});
