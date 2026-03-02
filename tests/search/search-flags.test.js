const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseSearchFlags } = requireDist("lib/search/flags.js");

test("parses query, limit, cursor, and json flag", () => {
  const parsed = parseSearchFlags(["agent", "--limit", "10", "--cursor", "abc123", "--json"]);

  assert.deepEqual(parsed, {
    query: "agent",
    limit: 10,
    cursor: "abc123",
    scope: "public",
    json: true,
    valid: true,
  });
});

test("parses --cursor value when it starts with hyphen", () => {
  const parsed = parseSearchFlags(["agent", "--cursor", "-abc123"]);

  assert.deepEqual(parsed, {
    query: "agent",
    limit: undefined,
    cursor: "-abc123",
    scope: "public",
    json: false,
    valid: true,
  });
});

test("parses --cursor equals form when value starts with double hyphen", () => {
  const parsed = parseSearchFlags(["agent", "--cursor=--json", "--json"]);

  assert.deepEqual(parsed, {
    query: "agent",
    limit: undefined,
    cursor: "--json",
    scope: "public",
    json: true,
    valid: true,
  });
});

test("parses browse mode with no args", () => {
  const parsed = parseSearchFlags([]);

  assert.deepEqual(parsed, {
    query: undefined,
    limit: undefined,
    cursor: undefined,
    scope: "public",
    json: false,
    valid: true,
  });
});

test("parses private scope", () => {
  const parsed = parseSearchFlags(["agent", "--scope", "private"]);

  assert.deepEqual(parsed, {
    query: "agent",
    limit: undefined,
    cursor: undefined,
    scope: "private",
    json: false,
    valid: true,
  });
});

for (const args of [
  ["a", "b"],
  ["agent", "--limit", "0"],
  ["agent", "--limit", "51"],
  ["agent", "--limit", "x"],
  ["agent", "--bad-flag"],
  ["agent", "--cursor"],
  ["agent", "--cursor", "--json"],
  ["agent", "--cursor", "--limit", "10"],
]) {
  test(`rejects invalid args: ${args.join(" ")}`, () => {
    const parsed = parseSearchFlags(args);
    assert.equal(parsed.valid, false);
  });
}
