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
          skillId: "@owner/test-skill",
          owner: "@owner",
          ownerLogin: "owner",
          skill: "test-skill",
          description: "desc",
          distTags: { latest: "1.2.3" },
          updatedAt: "2026-03-02T12:00:00.000Z",
        },
      ],
      nextCursor: null,
    }),
    readSelectionCache: () => null,
    writeSelectionCache: () => {},
    resolveReadIdToken: async () => "token",
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runSearchCommand(["--bad-flag"]));
  assert.equal(result, 1);
});

test("prints human output for search results", async () => {
  const { result, logs } = await captureConsole(() => runSearchCommand(["agent"], baseOptions()));
  assert.equal(result, 0);
  assert.match(logs.join("\n"), /@owner\/test-skill/);
  assert.match(logs.join("\n"), /1.2.3/);
});

test("prints json output with --json", async () => {
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(["agent", "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const payload = JSON.parse(logs.join("\n"));
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0].distTags.latest, "1.2.3");
});

test("requires login for private scope when no token exists", async () => {
  const { result, errors } = await captureConsole(() =>
    runSearchCommand(
      ["--scope", "private"],
      baseOptions({
        resolveReadIdToken: async () => null,
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /requires login/i);
});

test("private scope uses SKILLMD_AUTH_TOKEN when configured", async () => {
  let capturedIdToken = null;
  const { result } = await captureConsole(() =>
    runSearchCommand(
      ["--scope", "private"],
      baseOptions({
        env: {
          SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
          SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
          SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
          SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
          SKILLMD_FIREBASE_API_KEY: "api-key",
          SKILLMD_GITHUB_CLIENT_ID: "gh-client",
        },
        resolveReadIdToken: undefined,
        searchSkills: async (_baseUrl, _request, options) => {
          capturedIdToken = options.idToken ?? null;
          return {
            query: null,
            limit: 20,
            results: [],
            nextCursor: null,
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(capturedIdToken, "skmd_dev_tok_abc123abc123abc123abc123.secret");
});

test("maps search API errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runSearchCommand(
      ["agent"],
      baseOptions({
        searchSkills: async () => {
          throw new SearchApiError(500, "internal_error", "boom");
        },
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /boom/);
});

test("does not crash when result distTags are missing", async () => {
  const { result, logs } = await captureConsole(() =>
    runSearchCommand(
      ["agent"],
      baseOptions({
        searchSkills: async () => ({
          query: "agent",
          limit: 20,
          results: [
            {
              skillId: "@owner/test-skill",
              owner: "@owner",
              ownerLogin: "owner",
              skill: "test-skill",
              description: "desc",
              updatedAt: "2026-03-02T12:00:00.000Z",
            },
          ],
          nextCursor: null,
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  assert.match(logs.join("\n"), /@owner\/test-skill/);
});

test("prints pro-plan hint for private search denial", async () => {
  const { result, errors } = await captureConsole(() =>
    runSearchCommand(
      ["--scope", "private"],
      baseOptions({
        searchSkills: async () => {
          throw new SearchApiError(403, "forbidden", "private search is not allowed", {
            reason: "forbidden_plan",
          });
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.match(errors.join("\n"), /private search is not allowed/i);
  assert.match(errors.join("\n"), /private skills require a Pro plan/i);
});
