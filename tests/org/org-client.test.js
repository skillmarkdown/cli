const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { OrgApiError } = requireDist("lib/org/errors.js");
const {
  listOrganizationMembers,
  listOrganizationSkills,
  listOrganizationTeams,
  createOrganizationTeam,
  getOrganizationTeam,
  addOrganizationMember,
  removeOrganizationMember,
  addOrganizationTeamMember,
  removeOrganizationTeamMember,
  assignOrganizationSkillTeam,
} = requireDist("lib/org/client.js");

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
      assert.equal(init.method, "PUT");
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
