const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parsePublishFlags } = requireDist("lib/publish/flags.js");

test("parses required publish flags", () => {
  const parsed = parsePublishFlags(["./my-skill", "--version", "1.2.3", "--dry-run"]);

  assert.deepEqual(parsed, {
    pathArg: "./my-skill",
    version: "1.2.3",
    tag: undefined,
    access: undefined,
    provenance: false,
    agentTarget: undefined,
    dryRun: true,
    json: false,
    valid: true,
  });
});

test("parses tag/access/provenance/json flags", () => {
  const parsed = parsePublishFlags([
    "--version=1.2.3-beta.1",
    "--tag=beta",
    "--access=private",
    "--provenance",
    "--json",
  ]);

  assert.deepEqual(parsed, {
    pathArg: undefined,
    version: "1.2.3-beta.1",
    tag: "beta",
    access: "private",
    provenance: true,
    agentTarget: undefined,
    dryRun: false,
    json: true,
    valid: true,
  });
});

test("parses optional agent target flag", () => {
  const parsed = parsePublishFlags(["--version", "1.2.3", "--agent-target", "gemini"]);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.agentTarget, "gemini");
});

test("parses new builtin agent target flag", () => {
  const parsed = parsePublishFlags(["--version", "1.2.3", "--agent-target", "openai"]);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.agentTarget, "openai");
});

for (const args of [
  [],
  ["--version", "1.2"],
  ["--version", "1.2.3", "--tag", "UPPER"],
  ["--version", "1.2.3", "--tag", "1.2.3"],
  ["--version", "1.2.3", "--tag", "^1.2.0"],
  ["--version", "1.2.3", "--access", "team"],
  ["--version", "1.2.3", "--agent-target", "custom:UPPER"],
  ["--version", "1.2.3", "--oops"],
  ["a", "b", "--version", "1.2.3"],
]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parsePublishFlags(args);
    assert.equal(parsed.valid, false);
  });
}
