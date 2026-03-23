const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runOrgCommand } = requireDist("commands/org.js");
const { OrgApiError } = requireDist("lib/org/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
    },
    getAuthConfig: () => ({
      firebaseApiKey: "api-key",
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    getReadConfig: () => ({
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    resolveReadIdToken: async () => "id-token",
    getWhoami: async () => ({
      uid: "uid-1",
      owner: "@core",
      username: "core",
      email: "core@example.com",
      projectId: "skillmarkdown-development",
      authType: "firebase",
      scope: "admin",
      plan: "pro",
      organizations: [
        {
          slug: "facebook",
          owner: "@facebook",
          role: "admin",
        },
      ],
      organizationTeams: [
        {
          organizationSlug: "facebook",
          teamSlug: "core",
        },
      ],
    }),
    listOrganizationMembers: async () => ({
      slug: "facebook",
      owner: "@facebook",
      viewerRole: "owner",
      members: [
        {
          username: "maintainer",
          owner: "@maintainer",
          role: "admin",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    }),
    addOrganizationMember: async (_baseUrl, _idToken, slug, request) => ({
      slug,
      username: request.username,
      owner: `@${request.username}`,
      role: request.role,
    }),
    removeOrganizationMember: async (_baseUrl, _idToken, slug, username) => ({
      status: "removed",
      slug,
      username,
    }),
    createOrganization: async (_baseUrl, _idToken, request) => ({
      slug: request.slug,
      owner: `@${request.slug}`,
    }),
    listOrganizationTeams: async () => ({
      slug: "facebook",
      owner: "@facebook",
      viewerRole: "owner",
      teams: [
        {
          teamSlug: "core",
          name: "Core Team",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          members: [
            {
              username: "maintainer",
              owner: "@maintainer",
              createdAt: "2026-03-01T00:00:00.000Z",
              updatedAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        },
      ],
    }),
    getOrganizationTeam: async () => ({
      slug: "facebook",
      owner: "@facebook",
      viewerRole: "owner",
      team: {
        teamSlug: "core",
        name: "Core Team",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        members: [
          {
            username: "maintainer",
            owner: "@maintainer",
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      },
    }),
    createOrganizationTeam: async (_baseUrl, _idToken, slug, request) => ({
      slug,
      teamSlug: request.teamSlug,
      name: request.name,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    }),
    addOrganizationTeamMember: async (_baseUrl, _idToken, slug, teamSlug, request) => ({
      slug,
      teamSlug,
      username: request.username,
      owner: `@${request.username}`,
    }),
    removeOrganizationTeamMember: async (_baseUrl, _idToken, slug, teamSlug, username) => ({
      status: "removed",
      slug,
      teamSlug,
      username,
    }),
    listOrganizationSkills: async () => ({
      slug: "facebook",
      owner: "@facebook",
      viewerRole: "owner",
      skills: [
        {
          skillId: "@facebook/private-skill",
          owner: "@facebook",
          username: "facebook",
          skill: "private-skill",
          visibility: "private",
          latestVersion: "1.0.0",
          updatedAt: "2026-03-01T00:00:00.000Z",
          teamSlug: "core",
        },
      ],
    }),
    assignOrganizationSkillTeam: async (_baseUrl, _idToken, slug, skillSlug, teamSlug) => ({
      slug,
      skill: {
        skillId: `@${slug}/${skillSlug}`,
        owner: `@${slug}`,
        username: slug,
        skill: skillSlug,
        visibility: "private",
        latestVersion: "1.0.0",
        updatedAt: "2026-03-01T00:00:00.000Z",
        ...(teamSlug ? { teamSlug } : {}),
      },
    }),
    listOrganizationTokens: async () => ({
      tokens: [
        {
          tokenId: "tok_abc123abc123abc123abc123",
          name: "deploy",
          scope: "admin",
          createdAt: "2026-03-01T00:00:00.000Z",
          expiresAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    }),
    createOrganizationToken: async (_baseUrl, _idToken, slug, request) => ({
      tokenId: "tok_abc123abc123abc123abc123",
      token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      name: request.name,
      scope: request.scope ?? "publish",
      createdAt: "2026-03-01T00:00:00.000Z",
      expiresAt: "2026-04-01T00:00:00.000Z",
      slug,
    }),
    revokeOrganizationToken: async () => ({
      status: "revoked",
      tokenId: "tok_abc123abc123abc123abc123",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runOrgCommand(["bad"]));
  assert.equal(result, 1);
});

test("lists organizations in human output", async () => {
  const { result, logs } = await captureConsole(() => runOrgCommand(["ls"], baseOptions()));
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /@facebook role=admin/);
});

test("creates organization", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["create", "acme", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.slug, "acme");
  assert.equal(payload.owner, "@acme");
});

test("lists organization teams in json", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["team", "ls", "facebook", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.teams[0].teamSlug, "core");
});

test("lists organization members in human output", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["members", "ls", "facebook"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Organization: @facebook/);
  assert.match(logs.join("\n"), /- @maintainer role=admin/);
});

test("adds organization member", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["members", "add", "facebook", "maintainer", "--role", "admin"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Added @maintainer to @facebook as admin/);
});

test("removes organization member", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["members", "rm", "facebook", "maintainer"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Removed @maintainer from @facebook/);
});

test("creates organization team", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(
      ["team", "add", "facebook", "platform", "--name", "Platform Team"],
      baseOptions(),
    ),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Created team platform in @facebook/);
});

test("lists organization team members in human output", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["team", "members", "ls", "facebook", "core"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Team: core \(Core Team\)/);
  assert.match(logs.join("\n"), /- @maintainer/);
});

test("adds and removes organization team members", async () => {
  const addResult = await captureConsole(() =>
    runOrgCommand(["team", "members", "add", "facebook", "core", "maintainer"], baseOptions()),
  );
  assert.equal(addResult.result, 0);
  assert.match(addResult.logs.join("\n"), /Added @maintainer to team core in @facebook/);

  const removeResult = await captureConsole(() =>
    runOrgCommand(["team", "members", "rm", "facebook", "core", "maintainer"], baseOptions()),
  );
  assert.equal(removeResult.result, 0);
  assert.match(removeResult.logs.join("\n"), /Removed @maintainer from team core in @facebook/);
});

test("lists organization skills with full skill identity in human output", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["skills", "ls", "facebook"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /@facebook\/private-skill visibility=private/);
});

test("assigns and clears organization skill team", async () => {
  const addResult = await captureConsole(() =>
    runOrgCommand(["skills", "team", "set", "facebook", "private-skill", "core"], baseOptions()),
  );
  assert.equal(addResult.result, 0);
  assert.match(addResult.logs.join("\n"), /Updated @facebook\/private-skill team=core/);

  const clearResult = await captureConsole(() =>
    runOrgCommand(["skills", "team", "clear", "facebook", "private-skill"], baseOptions()),
  );
  assert.equal(clearResult.result, 0);
  assert.match(clearResult.logs.join("\n"), /Updated @facebook\/private-skill team=-/);
});

test("lists organization tokens in json", async () => {
  const { result, logs } = await captureConsole(() =>
    runOrgCommand(["tokens", "ls", "facebook", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.tokens[0].name, "deploy");
});

test("adds and removes organization tokens", async () => {
  const addResult = await captureConsole(() =>
    runOrgCommand(
      ["tokens", "add", "facebook", "deploy", "--scope", "admin", "--days", "7"],
      baseOptions(),
    ),
  );
  assert.equal(addResult.result, 0);
  assert.match(
    addResult.logs.join("\n"),
    /Created organization token tok_abc123abc123abc123abc123/,
  );

  const removeResult = await captureConsole(() =>
    runOrgCommand(["tokens", "rm", "facebook", "tok_abc123abc123abc123abc123"], baseOptions()),
  );
  assert.equal(removeResult.result, 0);
  assert.match(
    removeResult.logs.join("\n"),
    /Revoked organization token tok_abc123abc123abc123abc123/,
  );
});

test("prints helpful authz hint for membership failures", async () => {
  const { result, errors } = await captureConsole(() =>
    runOrgCommand(
      ["members", "ls", "facebook"],
      baseOptions({
        listOrganizationMembers: async () => {
          throw new OrgApiError(403, "forbidden", "organization membership is not allowed", {
            reason: "forbidden_membership",
          });
        },
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skillmd whoami/);
  assert.match(errors.join("\n"), /skillmd org/);
});

test("org create surfaces quota failures without swallowing the backend message", async () => {
  const { result, errors } = await captureConsole(() =>
    runOrgCommand(
      ["create", "facebook"],
      baseOptions({
        createOrganization: async () => {
          throw new OrgApiError(
            403,
            "plan_limit_exceeded",
            "free accounts can create up to 5 organizations",
            {
              resource: "organizations",
              currentCount: 5,
              maxAllowed: 5,
              plan: "free",
            },
          );
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /free accounts can create up to 5 organizations/);
});

test("org team add surfaces plan failures without swallowing the backend message", async () => {
  const { result, errors } = await captureConsole(() =>
    runOrgCommand(
      ["team", "add", "facebook", "core", "--name", "Core Team"],
      baseOptions({
        createOrganizationTeam: async () => {
          throw new OrgApiError(403, "forbidden", "teams are available on pro accounts only", {
            reason: "forbidden_plan",
            resource: "teams",
            plan: "free",
          });
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /teams are available on pro accounts only/);
});

test("org read commands fail when not logged in", async () => {
  const { result, errors } = await captureConsole(() =>
    runOrgCommand(
      ["team", "ls", "facebook"],
      baseOptions({
        resolveReadIdToken: async () => null,
      }),
    ),
  );

  assert.equal(result, 1);
  assert.deepEqual(errors, [
    "skillmd org: not logged in. Run 'skillmd login' first at https://www.skillmarkdown.com.",
  ]);
});
