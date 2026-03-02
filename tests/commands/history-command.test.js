const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runHistoryCommand } = requireDist("commands/history.js");
const { HistoryApiError } = requireDist("lib/history/errors.js");

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
    listHistory: async () => ({
      owner: "@stefdevscore",
      ownerLogin: "stefdevscore",
      skill: "test-skill",
      limit: 20,
      results: [
        {
          version: "1.2.3",
          digest: "sha256:abc",
          sizeBytes: 123,
          mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
          publishedAt: "2026-03-02T09:00:00.000Z",
          yanked: false,
          yankedAt: null,
          yankedReason: null,
        },
      ],
      nextCursor: "next_cursor",
    }),
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runHistoryCommand([]);
  assert.equal(exitCode, 1);
});

test("fails with usage when --cursor is missing a value and next token is a flag", async () => {
  const exitCode = await runHistoryCommand(["owner/skill", "--cursor", "--json"], baseOptions());
  assert.equal(exitCode, 1);
});

test("prints human output for history results", async () => {
  const { result, logs } = await captureConsole(() =>
    runHistoryCommand(["@stefdevscore/test-skill", "--limit", "20"], baseOptions()),
  );

  assert.equal(result, 0);
  assert.match(logs[0], /^┌/u);
  assert.match(logs[1], /VERSION/u);
  assert.match(logs[2], /^├/u);
  assert.match(logs[3], /1.2.3/);
  assert.match(logs[3], /sha256:abc/);
  assert.match(logs[4], /^└/u);
  assert.match(logs[5], /Next page:/);
});

test("prints yanked metadata and truncates digest in human output", async () => {
  const { result, logs } = await captureConsole(() =>
    runHistoryCommand(
      ["@stefdevscore/test-skill", "--limit", "10"],
      baseOptions({
        listHistory: async () => ({
          owner: "@stefdevscore",
          ownerLogin: "stefdevscore",
          skill: "test-skill",
          limit: 10,
          results: [
            {
              version: "1.2.3",
              digest: "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              sizeBytes: 12345,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              publishedAt: "2026-03-02T09:00:00.000Z",
              yanked: true,
              yankedAt: "2026-03-02T10:00:00.000Z",
              yankedReason: "security issue",
            },
          ],
          nextCursor: "cursor_2",
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs[3], /yes:securit.*\.\.\.|yes:security issue/);
  assert.match(logs[3], /sha256:1234567890.*\.\.\./);
  assert.equal(
    logs[5],
    "Next page: skillmd history @stefdevscore/test-skill --limit 10 --cursor cursor_2",
  );
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runHistoryCommand(["@stefdevscore/test-skill", "--json"], baseOptions()),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.ownerLogin, "stefdevscore");
  assert.equal(Array.isArray(parsed.results), true);
});

test("prints no-result message when empty", async () => {
  const { result, logs } = await captureConsole(() =>
    runHistoryCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        listHistory: async () => ({
          owner: "@stefdevscore",
          ownerLogin: "stefdevscore",
          skill: "test-skill",
          limit: 20,
          results: [],
          nextCursor: null,
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /No versions found\./);
});

test("fails on malformed skill id before API call", async () => {
  const { result, errors } = await captureConsole(() =>
    runHistoryCommand(["not-a-skill-id"], baseOptions()),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /skill id must be in the form/);
});

test("maps history api errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runHistoryCommand(
      ["@stefdevscore/test-skill"],
      baseOptions({
        listHistory: async () => {
          throw new HistoryApiError(400, "invalid_request", "bad cursor");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /bad cursor/);
});
