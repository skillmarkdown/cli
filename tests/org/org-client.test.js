const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { OrgApiError } = requireDist("lib/org/errors.js");
const {
  createOrganization,
  listOrganizationMembers,
  listOrganizationSkills,
  listOrganizationTokens,
  listOrganizationTeams,
  createOrganizationToken,
  createOrganizationTeam,
  getOrganizationTeam,
  addOrganizationMember,
  removeOrganizationMember,
  addOrganizationTeamMember,
  removeOrganizationTeamMember,
  assignOrganizationSkillTeam,
  revokeOrganizationToken,
} = requireDist("lib/org/client.js");

test("createOrganization sends payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(String(init.body)), {
        slug: "facebook",
      });
      return mockJsonResponse(200, {
        slug: "facebook",
        owner: "@facebook",
      });
    },
    () => createOrganization("https://registry.example.com", "id-token", { slug: "facebook" }),
  );

  assert.equal(payload.owner, "@facebook");
});

test("createOrganization surfaces plan quota denials", async () => {
  await assert.rejects(
    withMockedFetch(
      async () =>
        mockJsonResponse(403, {
          error: {
            code: "plan_limit_exceeded",
            message: "free accounts can create up to 5 organizations",
            details: {
              resource: "organizations",
              currentCount: 5,
              maxAllowed: 5,
              plan: "free",
            },
          },
        }),
      () =>
        createOrganization("https://registry.example.com", "id-token", {
          slug: "facebook",
        }),
    ),
    (error) => {
      assert.ok(error instanceof OrgApiError);
      assert.equal(error.code, "plan_limit_exceeded");
      assert.equal(error.message, "free accounts can create up to 5 organizations");
      assert.deepEqual(error.details, {
        resource: "organizations",
        currentCount: 5,
        maxAllowed: 5,
        plan: "free",
      });
      return true;
    },
  );
});

test("listOrganizationMembers parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/members");
      assert.equal(init.method, "GET");
      return mockJsonResponse(200, {
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
      });
    },
    () => listOrganizationMembers("https://registry.example.com", "id-token", "facebook"),
  );

  assert.equal(payload.members.length, 1);
  assert.equal(payload.members[0].role, "admin");
});

test("createOrganizationTeam sends payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/teams");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(String(init.body)), {
        teamSlug: "core",
        name: "Core Team",
      });
      return mockJsonResponse(200, {
        slug: "facebook",
        teamSlug: "core",
        name: "Core Team",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
    },
    () =>
      createOrganizationTeam("https://registry.example.com", "id-token", "facebook", {
        teamSlug: "core",
        name: "Core Team",
      }),
  );

  assert.equal(payload.teamSlug, "core");
});

test("createOrganizationTeam surfaces team plan quota denials", async () => {
  await assert.rejects(
    withMockedFetch(
      async () =>
        mockJsonResponse(403, {
          error: {
            code: "plan_limit_exceeded",
            message: "pro organizations can create up to 5 teams",
            details: {
              resource: "teams",
              organizationSlug: "facebook",
              currentCount: 5,
              maxAllowed: 5,
              plan: "pro",
            },
          },
        }),
      () =>
        createOrganizationTeam("https://registry.example.com", "id-token", "facebook", {
          teamSlug: "core",
          name: "Core Team",
        }),
    ),
    (error) => {
      assert.ok(error instanceof OrgApiError);
      assert.equal(error.code, "plan_limit_exceeded");
      assert.equal(error.message, "pro organizations can create up to 5 teams");
      assert.deepEqual(error.details, {
        resource: "teams",
        organizationSlug: "facebook",
        currentCount: 5,
        maxAllowed: 5,
        plan: "pro",
      });
      return true;
    },
  );
});

test("addOrganizationMember sends payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/members");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(String(init.body)), {
        username: "maintainer",
        role: "admin",
      });
      return mockJsonResponse(200, {
        slug: "facebook",
        username: "maintainer",
        owner: "@maintainer",
        role: "admin",
      });
    },
    () =>
      addOrganizationMember("https://registry.example.com", "id-token", "facebook", {
        username: "maintainer",
        role: "admin",
      }),
  );

  assert.equal(payload.owner, "@maintainer");
});

test("removeOrganizationMember sends delete request", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/members/maintainer");
      assert.equal(init.method, "DELETE");
      return mockJsonResponse(200, {
        status: "removed",
        slug: "facebook",
        username: "maintainer",
      });
    },
    () =>
      removeOrganizationMember(
        "https://registry.example.com",
        "id-token",
        "facebook",
        "maintainer",
      ),
  );

  assert.equal(payload.status, "removed");
});

test("listOrganizationTeams parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/teams");
      assert.equal(init.method, "GET");
      return mockJsonResponse(200, {
        slug: "facebook",
        owner: "@facebook",
        viewerRole: "owner",
        teams: [
          {
            teamSlug: "core",
            name: "Core Team",
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            members: [],
          },
        ],
      });
    },
    () => listOrganizationTeams("https://registry.example.com", "id-token", "facebook"),
  );

  assert.equal(payload.teams[0].name, "Core Team");
});

test("getOrganizationTeam parses team members", async () => {
  const payload = await withMockedFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/teams/core");
      return mockJsonResponse(200, {
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
      });
    },
    () => getOrganizationTeam("https://registry.example.com", "id-token", "facebook", "core"),
  );

  assert.equal(payload.team.members[0].owner, "@maintainer");
});

test("assignOrganizationSkillTeam sends null when clearing", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/skills/private-skill/team");
      assert.equal(init.method, "PATCH");
      assert.deepEqual(JSON.parse(String(init.body)), {
        teamSlug: null,
      });
      return mockJsonResponse(200, {
        slug: "facebook",
        skill: {
          skillId: "@facebook/private-skill",
          owner: "@facebook",
          username: "facebook",
          skill: "private-skill",
          visibility: "private",
          latestVersion: "1.0.0",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      });
    },
    () =>
      assignOrganizationSkillTeam(
        "https://registry.example.com",
        "id-token",
        "facebook",
        "private-skill",
        null,
      ),
  );

  assert.equal(payload.skill.teamSlug, undefined);
  assert.equal(payload.skill.skillId, "@facebook/private-skill");
});

test("listOrganizationTokens parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/tokens");
      assert.equal(init.method, "GET");
      return mockJsonResponse(200, {
        tokens: [
          {
            tokenId: "tok_abc123abc123abc123abc123",
            name: "ci",
            scope: "admin",
            createdAt: "2026-03-01T00:00:00.000Z",
            expiresAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      });
    },
    () => listOrganizationTokens("https://registry.example.com", "id-token", "facebook"),
  );

  assert.equal(payload.tokens[0].scope, "admin");
});

test("createOrganizationToken sends payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/tokens");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(String(init.body)), {
        name: "ci",
        scope: "publish",
        expiresDays: 7,
      });
      return mockJsonResponse(200, {
        tokenId: "tok_abc123abc123abc123abc123",
        token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
        name: "ci",
        scope: "publish",
        createdAt: "2026-03-01T00:00:00.000Z",
        expiresAt: "2026-03-08T00:00:00.000Z",
      });
    },
    () =>
      createOrganizationToken("https://registry.example.com", "id-token", "facebook", {
        name: "ci",
        scope: "publish",
        expiresDays: 7,
      }),
  );

  assert.equal(payload.tokenId, "tok_abc123abc123abc123abc123");
});

test("revokeOrganizationToken sends delete request", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/tokens/tok_abc123abc123abc123abc123");
      assert.equal(init.method, "DELETE");
      return mockJsonResponse(200, {
        status: "revoked",
        tokenId: "tok_abc123abc123abc123abc123",
      });
    },
    () =>
      revokeOrganizationToken(
        "https://registry.example.com",
        "id-token",
        "facebook",
        "tok_abc123abc123abc123abc123",
      ),
  );

  assert.equal(payload.status, "revoked");
});

test("addOrganizationTeamMember sends payload and parses response", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/teams/core/members");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(String(init.body)), {
        username: "maintainer",
      });
      return mockJsonResponse(200, {
        slug: "facebook",
        teamSlug: "core",
        username: "maintainer",
        owner: "@maintainer",
      });
    },
    () =>
      addOrganizationTeamMember("https://registry.example.com", "id-token", "facebook", "core", {
        username: "maintainer",
      }),
  );

  assert.equal(payload.teamSlug, "core");
});

test("removeOrganizationTeamMember sends delete request", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/teams/core/members/maintainer");
      assert.equal(init.method, "DELETE");
      return mockJsonResponse(200, {
        status: "removed",
        slug: "facebook",
        teamSlug: "core",
        username: "maintainer",
      });
    },
    () =>
      removeOrganizationTeamMember(
        "https://registry.example.com",
        "id-token",
        "facebook",
        "core",
        "maintainer",
      ),
  );

  assert.equal(payload.status, "removed");
});

test("listOrganizationSkills accepts real backend skill payload shape", async () => {
  const payload = await withMockedFetch(
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/organizations/facebook/skills");
      assert.equal(init.method, "GET");
      return mockJsonResponse(200, {
        slug: "facebook",
        owner: "@facebook",
        viewerRole: "owner",
        skills: [
          {
            skillId: "@facebook/private-skill",
            owner: "@facebook",
            username: "facebook",
            skill: "private-skill",
            description: "private org skill",
            visibility: "private",
            distTags: { latest: "1.0.0" },
            latestVersion: "1.0.0",
            updatedAt: "2026-03-01T00:00:00.000Z",
            teamSlug: "core",
          },
        ],
      });
    },
    () => listOrganizationSkills("https://registry.example.com", "id-token", "facebook"),
  );

  assert.equal(payload.skills.length, 1);
  assert.equal(payload.skills[0].skillId, "@facebook/private-skill");
  assert.equal(payload.skills[0].skill, "private-skill");
});

test("org client maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(403, {
        error: {
          code: "forbidden",
          message: "organization management is not allowed",
          details: { reason: "forbidden_membership" },
        },
      }),
    async () => {
      await assert.rejects(
        listOrganizationMembers("https://registry.example.com", "id-token", "facebook"),
        (error) => {
          assert.ok(error instanceof OrgApiError);
          assert.equal(error.status, 403);
          assert.equal(error.code, "forbidden");
          return true;
        },
      );
    },
  );
});
