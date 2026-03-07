const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runTeamCommand } = requireDist("commands/team.js");
const { TeamApiError } = requireDist("lib/team/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
    },
    getConfig: () => ({
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    resolveReadIdToken: async () => "id-token",
    createTeam: async () => ({
      team: "core-team",
      displayName: "Core Team",
      createdAt: "2026-03-04T00:00:00.000Z",
      role: "owner",
    }),
    getTeam: async () => ({
      team: "core-team",
      displayName: "Core Team",
      createdAt: "2026-03-04T00:00:00.000Z",
      updatedAt: "2026-03-04T00:01:00.000Z",
      role: "admin",
    }),
    listTeamMembers: async () => ({
      team: "core-team",
      members: [
        {
          uid: "uid-1",
          usernameHandle: "@core",
          username: "core",
          role: "owner",
          addedAt: "2026-03-04T00:00:00.000Z",
          updatedAt: "2026-03-04T00:00:00.000Z",
        },
      ],
    }),
    addTeamMember: async () => ({
      team: "core-team",
      usernameHandle: "@alice",
      username: "alice",
      role: "member",
      status: "added",
    }),
    updateTeamMemberRole: async () => ({
      team: "core-team",
      usernameHandle: "@alice",
      username: "alice",
      role: "admin",
      status: "updated",
    }),
    removeTeamMember: async () => ({
      team: "core-team",
      usernameHandle: "@alice",
      username: "alice",
      role: "admin",
      status: "removed",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runTeamCommand(["oops"]));
  assert.equal(result, 1);
});

test("fails with usage when set-role uses owner", async () => {
  const { result } = await captureConsole(() =>
    runTeamCommand(["members", "set-role", "core-team", "alice", "owner"], baseOptions()),
  );
  assert.equal(result, 1);
});

test("fails when not logged in", async () => {
  const { result, errors } = await captureConsole(() =>
    runTeamCommand(
      ["view", "core-team"],
      baseOptions({
        resolveReadIdToken: async () => null,
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /not logged in/i);
});

test("team create defaults display name from slug", async () => {
  let seenDisplayName = null;
  const { result, logs } = await captureConsole(() =>
    runTeamCommand(
      ["create", "core-team"],
      baseOptions({
        createTeam: async (_baseUrl, _idToken, request) => {
          seenDisplayName = request.displayName;
          return {
            team: "core-team",
            displayName: request.displayName,
            createdAt: "2026-03-04T00:00:00.000Z",
            role: "owner",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(seenDisplayName, "Core Team");
  assert.match(logs.join("\n"), /Team: core-team/);
});

test("team members lifecycle prints success", async () => {
  const { result, logs } = await captureConsole(() =>
    runTeamCommand(["members", "add", "core-team", "alice", "--role", "admin"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(
    logs.join("\n"),
    /Added @alice to core-team as member|Added @alice to core-team as admin/,
  );
});

test("team command maps ACL reasons and hints", async () => {
  const { result, errors } = await captureConsole(() =>
    runTeamCommand(
      ["view", "core-team"],
      baseOptions({
        getTeam: async () => {
          throw new TeamApiError(403, "forbidden", "forbidden", { reason: "forbidden_scope" });
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /reason=forbidden_scope/);
  assert.match(errors.join("\n"), /required scope/i);
});

test("team command prints teams disabled message on 404 not_found", async () => {
  const { result, errors } = await captureConsole(() =>
    runTeamCommand(
      ["view", "core-team"],
      baseOptions({
        getTeam: async () => {
          throw new TeamApiError(404, "not_found", "not found");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /teams API is unavailable/i);
});

test("team create supports json output", async () => {
  const { result, logs } = await captureConsole(() =>
    runTeamCommand(["create", "core-team", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.team, "core-team");
});
