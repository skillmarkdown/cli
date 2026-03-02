const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runSearchCommand } = requireDist("commands/search.js");
const { SearchApiError } = requireDist("lib/search/errors.js");
const { buildSearchContinuationKey } = requireDist("lib/search/selection-cache.js");

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
    writeSelectionCache: () => {},
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

test("continues row numbers on next-page cursor when cache has continuation", async () => {
  const cursor = "cursor_2";
  const continuationKey = buildSearchContinuationKey({
    registryBaseUrl: "https://registry.example.com",
    query: "agent",
    limit: 2,
    cursor,
  });

  const { result, logs } = await captureConsole(() =>
    runSearchCommand(
      ["agent", "--limit", "2", "--cursor", cursor],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@core/agent-skill"],
          continuations: [
            {
              key: continuationKey,
              nextIndex: 3,
              createdAt: "2026-03-02T12:01:00.000Z",
            },
          ],
        }),
        searchSkills: async () => ({
          query: "agent",
          limit: 2,
          results: [
            {
              skillId: "@core/agent-skill-3",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-skill-3",
              description: "page 2 row 1",
              channels: {
                latest: "1.0.3",
              },
              updatedAt: "2026-03-02T09:03:00.000Z",
            },
            {
              skillId: "@core/agent-skill-4",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-skill-4",
              description: "page 2 row 2",
              channels: {
                latest: "1.0.4",
              },
              updatedAt: "2026-03-02T09:04:00.000Z",
            },
          ],
          nextCursor: "cursor_3",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const output = logs.join("\n");
  assert.match(output, /│\s*3\s*│\s*@core\/agent-skill-3/u);
  assert.match(output, /│\s*4\s*│\s*@core\/agent-skill-4/u);
});

test("keeps 3-digit row numbers visible without truncating # column", async () => {
  const cursor = "cursor_100";
  const continuationKey = buildSearchContinuationKey({
    registryBaseUrl: "https://registry.example.com",
    query: "agent",
    limit: 1,
    cursor,
  });

  const { result, logs } = await captureConsole(() =>
    runSearchCommand(
      ["agent", "--limit", "1", "--cursor", cursor],
      baseOptions({
        readSelectionCache: () => ({
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@core/agent-skill-99"],
          pageStartIndex: 99,
          continuations: [
            {
              key: continuationKey,
              nextIndex: 100,
              createdAt: "2026-03-02T12:01:00.000Z",
            },
          ],
        }),
        searchSkills: async () => ({
          query: "agent",
          limit: 1,
          results: [
            {
              skillId: "@core/agent-skill-100",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-skill-100",
              description: "page 100",
              channels: {
                latest: "1.0.100",
              },
              updatedAt: "2026-03-02T09:00:00.000Z",
            },
          ],
          nextCursor: null,
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const output = logs.join("\n");
  assert.match(output, /│\s*100\s*│\s*@core\/agent-skill-100/u);
  assert.doesNotMatch(output, /│\s*\.\.\s*│/u);
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
  const output = logs.join("\n");
  assert.match(output, /^┌/mu);
  assert.match(output, /│\s*#\s*│\s*SKILL/u);
  assert.match(output, /SKILL/u);
  assert.match(output, /LATEST/u);
  assert.match(output, /UPDATED/u);
  assert.doesNotMatch(output, /BETA/u);
  assert.match(output, /│\s*1\s*│\s*@core\/agent-skill/u);
  assert.match(output, /@core\/agent-skill/u);
  assert.match(output, /2026-03-02T09:00/u);
  assert.match(output, /^└/mu);
  assert.match(output, /Next page:/u);
});

test("writes ordered selection cache for numeric view lookup", async () => {
  let savedCache = null;
  const { result } = await captureConsole(() =>
    runSearchCommand(
      ["agent", "--limit", "20"],
      baseOptions({
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
            {
              skillId: "@core/agent-next",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-next",
              description: "Next skill",
              channels: {
                latest: "1.1.0",
              },
              updatedAt: "2026-03-02T10:00:00.000Z",
            },
          ],
          nextCursor: null,
        }),
        writeSelectionCache: (cache) => {
          savedCache = cache;
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.ok(savedCache);
  assert.equal(savedCache.registryBaseUrl, "https://registry.example.com");
  assert.match(savedCache.createdAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(savedCache.pageStartIndex, 1);
  assert.deepEqual(savedCache.skillIds, ["@core/agent-skill", "@core/agent-next"]);
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
  const output = logs.join("\n");
  assert.match(output, /\.\.\./u);
  assert.match(output, /Next page: skillmd search agent --limit 10 --cursor cursor_2/u);
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
