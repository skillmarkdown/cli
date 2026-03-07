const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { parseTeamFlags } = requireDist("lib/team/flags.js");

test("parses create flags", () => {
  const parsed = parseTeamFlags(["create", "core-team", "--display-name", "Core Team", "--json"]);
  assert.deepEqual(parsed, {
    valid: true,
    action: "create",
    team: "core-team",
    displayName: "Core Team",
    json: true,
  });
});

test("parses members add defaults", () => {
  const parsed = parseTeamFlags(["members", "add", "core-team", "owner-login"]);
  assert.deepEqual(parsed, {
    valid: true,
    action: "members_add",
    team: "core-team",
    username: "owner-login",
    role: "member",
    json: false,
  });
});

test("parses members set-role", () => {
  const parsed = parseTeamFlags([
    "members",
    "set-role",
    "core-team",
    "owner-login",
    "admin",
    "--json",
  ]);
  assert.deepEqual(parsed, {
    valid: true,
    action: "members_set_role",
    team: "core-team",
    username: "owner-login",
    role: "admin",
    json: true,
  });
});

test("rejects invalid args", () => {
  const cases = [
    [],
    ["create"],
    ["members", "add", "core-team"],
    ["members", "add", "core-team", "owner", "--role", "owner"],
    ["members", "set-role", "core-team", "owner", "owner"],
    ["members", "set-role", "core-team", "owner", "bad"],
    ["view", "bad_slug"],
    ["oops"],
  ];

  for (const args of cases) {
    const parsed = parseTeamFlags(args);
    assert.deepEqual(parsed, { valid: false, json: false });
  }
});
