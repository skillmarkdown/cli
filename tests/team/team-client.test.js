const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { mockJsonResponse, withMockedFetch } = require("../helpers/fetch-test-utils.js");

const { TeamApiError } = requireDist("lib/team/errors.js");
const {
  createTeam,
  getTeam,
  listTeamMembers,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
} = requireDist("lib/team/client.js");

test("team client create/get/list/add/update/remove success", async () => {
  let call = 0;
  await withMockedFetch(
    async (input, init) => {
      call += 1;
      const url = new URL(String(input));

      if (call === 1) {
        assert.equal(init.method, "POST");
        assert.equal(url.pathname, "/v1/teams");
        return mockJsonResponse(200, {
          team: "core-team",
          displayName: "Core Team",
          createdAt: "2026-03-04T00:00:00.000Z",
          role: "owner",
        });
      }
      if (call === 2) {
        assert.equal(init.method, "GET");
        assert.equal(url.pathname, "/v1/teams/core-team");
        return mockJsonResponse(200, {
          team: "core-team",
          displayName: "Core Team",
          createdAt: "2026-03-04T00:00:00.000Z",
          updatedAt: "2026-03-04T00:00:00.000Z",
          role: "admin",
        });
      }
      if (call === 3) {
        assert.equal(init.method, "GET");
        assert.equal(url.pathname, "/v1/teams/core-team/members");
        return mockJsonResponse(200, {
          team: "core-team",
          members: [
            {
              usernameHandle: "@core",
              username: "core",
              role: "owner",
              addedAt: "2026-03-04T00:00:00.000Z",
              updatedAt: "2026-03-04T00:00:00.000Z",
            },
          ],
        });
      }
      if (call === 4) {
        assert.equal(init.method, "POST");
        assert.equal(url.pathname, "/v1/teams/core-team/members");
        return mockJsonResponse(200, {
          team: "core-team",
          status: "added",
          member: {
            usernameHandle: "@alice",
            username: "alice",
            role: "member",
          },
        });
      }
      if (call === 5) {
        assert.equal(init.method, "PATCH");
        assert.equal(url.pathname, "/v1/teams/core-team/members/alice");
        return mockJsonResponse(200, {
          team: "core-team",
          status: "updated",
          member: {
            usernameHandle: "@alice",
            username: "alice",
            role: "admin",
          },
        });
      }

      assert.equal(init.method, "DELETE");
      assert.equal(url.pathname, "/v1/teams/core-team/members/alice");
      return mockJsonResponse(200, {
        team: "core-team",
        usernameHandle: "@alice",
        username: "alice",
        role: "member",
        status: "removed",
      });
    },
    async () => {
      const created = await createTeam("https://registry.example.com", "id-token", {
        team: "core-team",
        displayName: "Core Team",
      });
      assert.equal(created.role, "owner");

      const team = await getTeam("https://registry.example.com", "id-token", "core-team");
      assert.equal(team.role, "admin");

      const members = await listTeamMembers(
        "https://registry.example.com",
        "id-token",
        "core-team",
      );
      assert.equal(members.members.length, 1);
      assert.equal(members.members[0].username, "core");

      const added = await addTeamMember("https://registry.example.com", "id-token", "core-team", {
        username: "alice",
        role: "member",
      });
      assert.equal(added.status, "added");
      assert.equal(added.username, "alice");

      const updated = await updateTeamMemberRole(
        "https://registry.example.com",
        "id-token",
        "core-team",
        "alice",
        { role: "admin" },
      );
      assert.equal(updated.status, "updated");
      assert.equal(updated.role, "admin");

      const removed = await removeTeamMember(
        "https://registry.example.com",
        "id-token",
        "core-team",
        "alice",
      );
      assert.equal(removed.status, "removed");
      assert.equal(removed.username, "alice");
    },
  );
});

test("team client maps API errors", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(403, {
        error: {
          code: "forbidden",
          message: "forbidden",
          details: { reason: "forbidden_scope" },
        },
      }),
    async () => {
      await assert.rejects(
        createTeam("https://registry.example.com", "id-token", {
          team: "core-team",
          displayName: "Core Team",
        }),
        (error) => {
          assert.ok(error instanceof TeamApiError);
          assert.equal(error.status, 403);
          assert.equal(error.code, "forbidden");
          return true;
        },
      );
    },
  );
});
