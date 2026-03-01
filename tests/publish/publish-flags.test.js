const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { isPrereleaseVersion, parsePublishFlags } = requireDist("lib/publish/flags.js");

test("parses required flags with separate values", () => {
  const parsed = parsePublishFlags(["./my-skill", "--version", "1.2.3", "--dry-run"]);

  assert.deepEqual(parsed, {
    pathArg: "./my-skill",
    version: "1.2.3",
    channel: undefined,
    dryRun: true,
    json: false,
    valid: true,
  });
});

test("parses equals syntax and json/channel flags", () => {
  const parsed = parsePublishFlags(["--version=1.2.3-beta.1", "--channel=beta", "--json"]);

  assert.deepEqual(parsed, {
    pathArg: undefined,
    version: "1.2.3-beta.1",
    channel: "beta",
    dryRun: false,
    json: true,
    valid: true,
  });
});

for (const args of [
  [],
  ["--version", "1.2"],
  ["--version", "1.2.3", "--channel", "rc"],
  ["--version", "1.2.3", "--oops"],
  ["a", "b", "--version", "1.2.3"],
]) {
  test(`rejects invalid args: ${args.join(" ") || "<none>"}`, () => {
    const parsed = parsePublishFlags(args);
    assert.equal(parsed.valid, false);
  });
}

test("detects prerelease versions", () => {
  assert.equal(isPrereleaseVersion("1.2.3-alpha.1"), true);
  assert.equal(isPrereleaseVersion("1.2.3"), false);
});

test("accepts version-only publish flags", () => {
  const parsed = parsePublishFlags(["--version", "1.2.3"]);
  assert.deepEqual(parsed, {
    pathArg: undefined,
    version: "1.2.3",
    channel: undefined,
    dryRun: false,
    json: false,
    valid: true,
  });
});
