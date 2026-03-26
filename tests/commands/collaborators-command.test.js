const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runCollaboratorsCommand } = requireDist("commands/collaborators.js");
const { CollaboratorsApiError } = requireDist("lib/collaborators/errors.js");

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
    listSkillCollaborators: async (_baseUrl, _idToken, skillSlug) => ({
      owner: "@core",
      username: "core",
      skill: skillSlug,
      collaborators: [
        {
          username: "maintainer",
          role: "maintainer",
          addedAt: "2026-03-01T00:00:00.000Z",
          avatarUrl: "https://cdn.example.com/maintainer.png",
          lastPublishedAt: "2026-03-02T00:00:00.000Z",
        },
      ],
    }),
    addSkillCollaborator: async (_baseUrl, _idToken, skillSlug, request) => ({
      owner: "@core",
      username: "core",
      skill: skillSlug,
      collaborator: {
        username: request.username,
        role: "maintainer",
      },
    }),
    removeSkillCollaborator: async (_baseUrl, _idToken, skillSlug, username) => ({
      owner: "@core",
      username: "core",
      skill: skillSlug,
      collaborator: {
        username,
      },
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runCollaboratorsCommand(["bad"]));
  assert.equal(result, 1);
});

test("lists collaborators in human output", async () => {
  const { result, logs } = await captureConsole(() =>
    runCollaboratorsCommand(["ls", "test-skill"], baseOptions()),
  );
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Skill: @core\/test-skill/);
  assert.match(logs.join("\n"), /@maintainer role=maintainer/);
});

test("adds collaborator with normalized username and maintainer role", async () => {
  let capturedRequest = null;
  const { result, logs } = await captureConsole(() =>
    runCollaboratorsCommand(
      ["add", "test-skill", "@Maintainer"],
      baseOptions({
        addSkillCollaborator: async (_baseUrl, _idToken, skillSlug, request) => {
          capturedRequest = { skillSlug, request };
          return {
            owner: "@core",
            username: "core",
            skill: skillSlug,
            collaborator: {
              username: request.username,
              role: "maintainer",
            },
          };
        },
      }),
    ),
  );
  assert.equal(result, 0);
  assert.deepEqual(capturedRequest, {
    skillSlug: "test-skill",
    request: { username: "maintainer", role: "maintainer" },
  });
  assert.match(logs.join("\n"), /Added @maintainer to test-skill as maintainer/);
});

test("removes collaborator with normalized username", async () => {
  let captured = null;
  const { result, logs } = await captureConsole(() =>
    runCollaboratorsCommand(
      ["rm", "test-skill", " Maintainer "],
      baseOptions({
        removeSkillCollaborator: async (_baseUrl, _idToken, skillSlug, username) => {
          captured = { skillSlug, username };
          return {
            owner: "@core",
            username: "core",
            skill: skillSlug,
            collaborator: { username },
          };
        },
      }),
    ),
  );
  assert.equal(result, 0);
  assert.deepEqual(captured, { skillSlug: "test-skill", username: "maintainer" });
  assert.match(logs.join("\n"), /Removed @maintainer from test-skill/);
});

test("rejects org-owned skill ids locally", async () => {
  const { result, errors } = await captureConsole(() =>
    runCollaboratorsCommand(["ls", "@facebook/test-skill"], baseOptions()),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /bare personal skill ids only/);
});

test("read path fails when not logged in", async () => {
  const { result } = await captureConsole(() =>
    runCollaboratorsCommand(
      ["ls", "test-skill"],
      baseOptions({ resolveReadIdToken: async () => null }),
    ),
  );
  assert.equal(result, 1);
});

test("prints helpful authz hint for collaborator API failures", async () => {
  const { result, errors } = await captureConsole(() =>
    runCollaboratorsCommand(
      ["add", "test-skill", "maintainer"],
      baseOptions({
        addSkillCollaborator: async () => {
          throw new CollaboratorsApiError(
            403,
            "forbidden",
            "collaborator management is not allowed",
            { reason: "forbidden_role" },
          );
        },
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /verify your owner identity/i);
});
