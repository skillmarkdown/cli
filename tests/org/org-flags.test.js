const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { parseOrgFlags } = requireDist("lib/org/flags.js");

test("parses org ls", () => {
  assert.deepEqual(parseOrgFlags(["ls", "--json"]), {
    valid: true,
    action: "ls",
    json: true,
  });
});

test("parses members add with explicit role", () => {
  assert.deepEqual(parseOrgFlags(["members", "add", "facebook", "maintainer", "--role", "admin"]), {
    valid: true,
    action: "members.add",
    slug: "facebook",
    username: "maintainer",
    role: "admin",
    json: false,
  });
});

test("parses team add with display name", () => {
  assert.deepEqual(parseOrgFlags(["team", "add", "facebook", "core", "--name", "Core Team"]), {
    valid: true,
    action: "team.add",
    slug: "facebook",
    teamSlug: "core",
    name: "Core Team",
    json: false,
  });
});

test("parses team member removal", () => {
  assert.deepEqual(parseOrgFlags(["team", "members", "rm", "facebook", "core", "maintainer"]), {
    valid: true,
    action: "team.members.rm",
    slug: "facebook",
    teamSlug: "core",
    username: "maintainer",
    json: false,
  });
});

test("parses skill team set and clear", () => {
  assert.deepEqual(parseOrgFlags(["skills", "team", "set", "facebook", "private-skill", "core"]), {
    valid: true,
    action: "skills.team.set",
    slug: "facebook",
    skillSlug: "private-skill",
    teamSlug: "core",
    json: false,
  });
  assert.deepEqual(parseOrgFlags(["skills", "team", "clear", "facebook", "private-skill"]), {
    valid: true,
    action: "skills.team.clear",
    slug: "facebook",
    skillSlug: "private-skill",
    json: false,
  });
});

test("parses organization token commands", () => {
  assert.deepEqual(parseOrgFlags(["tokens", "ls", "facebook", "--json"]), {
    valid: true,
    action: "tokens.ls",
    slug: "facebook",
    json: true,
  });
  assert.deepEqual(
    parseOrgFlags(["tokens", "add", "facebook", "deploy", "--scope", "admin", "--days", "7"]),
    {
      valid: true,
      action: "tokens.add",
      slug: "facebook",
      name: "deploy",
      scope: "admin",
      days: 7,
      json: false,
    },
  );
  assert.deepEqual(parseOrgFlags(["tokens", "rm", "facebook", "tok_abc123abc123abc123abc123"]), {
    valid: true,
    action: "tokens.rm",
    slug: "facebook",
    tokenId: "tok_abc123abc123abc123abc123",
    json: false,
  });
});

test("rejects invalid org args", () => {
  for (const args of [
    [],
    ["members", "add", "facebook"],
    ["team", "add", "facebook", "core"],
    ["members", "add", "facebook", "maintainer", "--role", "bad"],
    ["skills", "team", "set", "facebook", "private-skill"],
    ["tokens", "add", "facebook", "deploy", "--scope", "read"],
    ["tokens", "rm", "facebook", "bad"],
  ]) {
    assert.deepEqual(parseOrgFlags(args), { valid: false, json: false });
  }
});
