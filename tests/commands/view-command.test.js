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
    getSkillView: async () => ({
      owner: "@stefdevscore",
      ownerLogin: "stefdevscore",
      skill: "test-skill",
      description: "Sample description",
      visibility: "public",
      channels: {
        latest: "1.0.0",
        beta: "1.1.0-beta.1",
      },
      updatedAt: "2026-03-02T09:00:00.000Z",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runViewCommand([]);
  assert.equal(exitCode, 1);
});

test("prints human output for skill view", async () => {
  const { result, logs } = await captureConsole(() =>
    runViewCommand(["@stefdevscore/test-skill"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /Skill: @stefdevscore\/test-skill/);
  assert.match(logs.join("\n"), /Updated:/);
  assert.match(logs.join("\n"), /latest: 1.0.0/);
  assert.match(logs.join("\n"), /beta: 1.1.0-beta.1/);
  assert.match(logs.join("\n"), /Next: skillmd history @stefdevscore\/test-skill --limit 20/);
});

test("resolves numeric index from cached search results", async () => {
  let receivedRequest = null;
  const { result, logs } = await captureConsole(() =>
    runViewCommand(
      ["1"],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@stefdevscore/test-skill"],
        }),
        getSkillView: async (_baseUrl, request) => {
          receivedRequest = request;
          return {
            owner: "@stefdevscore",
            ownerLogin: "stefdevscore",
            skill: "test-skill",
            description: "Sample description",
            visibility: "public",
            channels: {
              latest: "1.0.0",
            },
            updatedAt: "2026-03-02T09:00:00.000Z",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(receivedRequest, { ownerSlug: "stefdevscore", skillSlug: "test-skill" });
  assert.match(logs.join("\n"), /Skill: @stefdevscore\/test-skill/);
});

test("resolves numeric index from continued page range", async () => {
  let receivedRequest = null;
  const { result } = await captureConsole(() =>
    runViewCommand(
      ["4"],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          pageStartIndex: 4,
          skillIds: ["@stefdevscore/test-skill-4", "@stefdevscore/test-skill-5"],
        }),
        getSkillView: async (_baseUrl, request) => {
          receivedRequest = request;
          return {
            owner: "@stefdevscore",
            ownerLogin: "stefdevscore",
            skill: "test-skill-4",
            description: "Sample description",
            visibility: "public",
            channels: {
              latest: "1.0.0",
            },
            updatedAt: "2026-03-02T09:00:00.000Z",
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.deepEqual(receivedRequest, { ownerSlug: "stefdevscore", skillSlug: "test-skill-4" });
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runViewCommand(["@stefdevscore/test-skill", "--json"], baseOptions()),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.ownerLogin, "stefdevscore");
  assert.equal(parsed.skill, "test-skill");
});

test("fails on malformed skill id before API call", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(["not-a-skill-id"], baseOptions()),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skill id must be in the form/);
});

test("maps view api errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        getSkillView: async () => {
          throw new ViewApiError(404, "invalid_request", "skill not found");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skill not found/);
});

test("fails when numeric index has no cached search results", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(
      ["1"],
      baseOptions({
        readSelectionCache: () => null,
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /no cached search results found/);
});

test("fails when numeric index cache was produced by a different registry", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(
      ["1"],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://another.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@stefdevscore/test-skill"],
        }),
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /different registry/);
});

test("fails when numeric index is out of range for cached search results", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(
      ["2"],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@stefdevscore/test-skill"],
        }),
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /out of range/);
});

test("fails when numeric index is zero", async () => {
  const { result, errors } = await captureConsole(() =>
    runViewCommand(
      ["0"],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@stefdevscore/test-skill"],
        }),
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /positive integer/);
});
