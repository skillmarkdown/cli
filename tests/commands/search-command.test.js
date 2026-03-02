const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runSearchCommand } = requireDist("commands/search.js");
const { SearchApiError } = requireDist("lib/search/errors.js");

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
    searchSkills: async () => ({
      query: "agent",
      limit: 20,
      results: [
        {
          skillId: "@core/agent-skill",
          owner: "@core",
          ownerLogin: "core",
          skill: "agent-skill",
          description: "Sample description",
          channels: {
            latest: "1.0.0",
          },
          updatedAt: "2026-03-02T09:00:00.000Z",
        },
      ],
      nextCursor: "next_cursor",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runSearchCommand(["one", "two"]);
  assert.equal(exitCode, 1);
});

test("fails with usage when --cursor is missing a value and next token is a flag", async () => {
  const exitCode = await runSearchCommand(["agent", "--cursor", "--json"], baseOptions());
  assert.equal(exitCode, 1);
});

test("prints human output for search results", async () => {
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(["agent", "--limit", "20"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs[0], /^┌/u);
  assert.match(logs[1], /SKILL/u);
  assert.match(logs[1], /LATEST/u);
  assert.match(logs[1], /UPDATED/u);
  assert.doesNotMatch(logs[1], /BETA/u);
  assert.match(logs[2], /^├/u);
  assert.match(logs[3], /@core\/agent-skill/);
  assert.match(logs[3], /2026-03-02T09:00/);
  assert.match(logs[4], /^└/u);
  assert.match(logs[5], /Next page:/);
});

test("truncates long search descriptions and preserves next-page hint", async () => {
  const longDescription =
    "This is a very long description that should be truncated in table output so column widths stay stable across rows and pages.";
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(
      ["agent", "--limit", "10"],
      baseOptions({
        searchSkills: async () => ({
          query: "agent",
          limit: 10,
          results: [
            {
              skillId: "@core/agent-skill",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-skill",
              description: longDescription,
              channels: {
                latest: "1.0.0",
              },
              updatedAt: "2026-03-02T09:00:00.000Z",
            },
          ],
          nextCursor: "cursor_2",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs[3], /\.\.\./);
  assert.equal(logs[5], "Next page: skillmd search agent --limit 10 --cursor cursor_2");
});

test("wraps long skill ids across table lines for visibility", async () => {
  const longSkillId =
    "@stefdevscore/pagetest-super-long-skill-name-for-table-visibility-check-260302";
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(
      ["agent"],
      baseOptions({
        searchSkills: async () => ({
          query: "agent",
          limit: 20,
          results: [
            {
              skillId: longSkillId,
              owner: "@stefdevscore",
              ownerLogin: "stefdevscore",
              skill: "pagetest-super-long-skill-name-for-table-visibility-check-260302",
              description: "short description",
              channels: {
                latest: "0.1.0",
              },
              updatedAt: "2026-03-02T12:56:00.000Z",
            },
          ],
          nextCursor: null,
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const output = logs.join("\n");
  assert.match(output, /@stefdevscore\/pagetest-super-long-skill-name/u);
  assert.match(output, /visibility-check-260302/u);
  assert.match(output, /2026-03-02T12:56/u);
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(["agent", "--json"], baseOptions()),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.query, "agent");
  assert.equal(Array.isArray(parsed.results), true);
});

test("prints no-result message when empty", async () => {
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(
      [],
      baseOptions({
        searchSkills: async () => ({
          query: null,
          limit: 20,
          results: [],
          nextCursor: null,
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /No skills found\./);
});

test("maps search api errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runSearchCommand(
      ["agent"],
      baseOptions({
        searchSkills: async () => {
          throw new SearchApiError(400, "invalid_request", "bad query");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /bad query/);
});
