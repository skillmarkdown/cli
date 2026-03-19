const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runViewCommand } = requireDist("commands/view.js");
const { ViewApiError } = requireDist("lib/view/errors.js");

function baseOptions(overrides = {}) {
  return {
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
    },
    getConfig: () => ({
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
    }),
    readSelectionCache: () => null,
    getSkillView: async () => ({
      owner: "@owner",
      username: "username",
      skill: "test-skill",
      description: "desc",
      access: "public",
      distTags: { latest: "1.2.3", beta: "1.3.0-beta.1" },
      updatedAt: "2026-03-02T12:00:00.000Z",
    }),
    resolveReadIdToken: async () => null,
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runViewCommand([]));
  assert.equal(result, 1);
});

test("prints human output for skill view", async () => {
  const { result, logs } = await captureConsole(() =>
    runViewCommand(["test-skill"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Skill: test-skill/);
  assert.match(logs.join("\n"), /Access: public/);
  assert.match(logs.join("\n"), /latest: 1.2.3/);
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runViewCommand(["test-skill", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.skill, "test-skill");
  assert.equal(payload.distTags.latest, "1.2.3");
});

test("prints bare skill id for user-owned skills", async () => {
  const { result, logs } = await captureConsole(() =>
    runViewCommand(["test-skill"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Skill: test-skill/);
  assert.match(logs.join("\n"), /skillmd history test-skill --limit 20/);
});

test("resolves numeric index from cached search results", async () => {
  const { result } = await captureConsole(() =>
    runViewCommand(
      ["2"],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          skillIds: ["a", "b"],
          pageStartIndex: 1,
          updatedAt: "2026-03-02T00:00:00.000Z",
          continuations: [],
        }),
      }),
    ),
  );

  assert.equal(result, 0);
});

test("maps view API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(
      ["test-skill"],
      baseOptions({
        getSkillView: async () => {
          throw new ViewApiError(404, "not_found", "missing");
        },
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /missing/);
});
