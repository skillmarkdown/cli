const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  const modulePath = pathToFileURL(
    path.join(__dirname, "..", "..", "scripts", "command-sweep-utils.mjs"),
  ).href;
  return import(modulePath);
}

test("pickFirstNonEmpty skips empty values and returns trimmed value", async () => {
  const { pickFirstNonEmpty } = await loadModule();
  const resolved = pickFirstNonEmpty("", "   ", " value ", "fallback");
  assert.equal(resolved, "value");
});

test("sanitizeText redacts token payloads and auth headers", async () => {
  const { sanitizeText } = await loadModule();
  const raw =
    '{"token":"skmd_live_tok_abc123abc123abc123abc123.secretpart","note":"ok"}\n' +
    "Authorization: Bearer abc.def.ghi";
  const sanitized = sanitizeText(raw);
  assert.match(sanitized, /"token":"\[REDACTED\]"/);
  assert.match(sanitized, /Authorization: Bearer \[REDACTED\]/);
  assert.doesNotMatch(sanitized, /secretpart/);
});

test("sanitizeArgs redacts --auth-token value forms", async () => {
  const { sanitizeArgs } = await loadModule();
  const args = ["search", "--auth-token", "plain-token", "--other", "--auth-token=inline-token"];
  const sanitized = sanitizeArgs(args);
  assert.deepEqual(sanitized, [
    "search",
    "--auth-token",
    "[REDACTED]",
    "--other",
    "--auth-token=[REDACTED]",
  ]);
  assert.deepEqual(args, [
    "search",
    "--auth-token",
    "plain-token",
    "--other",
    "--auth-token=inline-token",
  ]);
});

test("sanitizeStepForOutput redacts without mutating the input object", async () => {
  const { sanitizeStepForOutput } = await loadModule();
  const original = {
    name: "token-add",
    status: "pass",
    args: ["token", "add", "name", "--auth-token", "abc"],
    stdout:
      '{"token":"skmd_dev_tok_deadbeefdeadbeefdeadbeef.secret","tokenId":"tok_deadbeefdeadbeefdeadbeef"}',
    stderr: "",
    combined:
      '{"token":"skmd_dev_tok_deadbeefdeadbeefdeadbeef.secret","tokenId":"tok_deadbeefdeadbeefdeadbeef"}',
    exitCode: 0,
    cwd: "/tmp",
    durationMs: 1,
  };

  const sanitized = sanitizeStepForOutput(original);
  assert.equal(sanitized.args[4], "[REDACTED]");
  assert.match(sanitized.stdout, /"token":"\[REDACTED\]"/);
  assert.doesNotMatch(sanitized.stdout, /\.secret/);
  assert.equal(original.args[4], "abc");
  assert.match(original.stdout, /\.secret/);
});
