const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runReportCommand } = requireDist("commands/report.js");
const { ReportApiError } = requireDist("lib/report/errors.js");

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
    submitMalwareReport: async () => ({
      reportId: "smr_123",
      status: "received",
    }),
    ...overrides,
  };
}

const VALID_ARGS = [
  "malware",
  "@core/test-skill",
  "--reason",
  "malware",
  "--description",
  "Installs unexpected binary payloads.",
  "--reported-version",
  "1.2.3",
  "--source-url",
  "https://example.com/repro",
  "--evidence-url",
  "https://example.com/log-1",
  "--evidence-url",
  "https://example.com/log-2",
];

test("fails with usage on invalid args", async () => {
  const { result } = await captureConsole(() => runReportCommand(["bad"]));
  assert.equal(result, 1);
});

test("report malware validates required flags", async () => {
  const { result } = await captureConsole(() =>
    runReportCommand(["malware", "test-skill", "--reason", "malware"], baseOptions()),
  );
  assert.equal(result, 1);
});

test("report malware validates reason and urls locally", async () => {
  const { result } = await captureConsole(() =>
    runReportCommand(
      [
        "malware",
        "test-skill",
        "--reason",
        "invalid",
        "--description",
        "desc",
        "--reported-version",
        "1.0.0",
        "--source-url",
        "ftp://example.com/source",
      ],
      baseOptions(),
    ),
  );
  assert.equal(result, 1);
});

test("report malware sends exact backend payload shape", async () => {
  let captured = null;
  const { result, logs } = await captureConsole(() =>
    runReportCommand(
      VALID_ARGS,
      baseOptions({
        submitMalwareReport: async (_baseUrl, _idToken, request) => {
          captured = request;
          return { reportId: "smr_456", status: "received" };
        },
      }),
    ),
  );
  assert.equal(result, 0);
  assert.deepEqual(captured, {
    skillId: "@core/test-skill",
    reportedVersion: "1.2.3",
    reason: "malware",
    description: "Installs unexpected binary payloads.",
    sourceUrl: "https://example.com/repro",
    evidenceUrls: ["https://example.com/log-1", "https://example.com/log-2"],
  });
  assert.match(logs.join("\n"), /Malware report submitted for @core\/test-skill/);
  assert.match(logs.join("\n"), /Report ID: smr_456/);
});

test("report malware prints stable json output", async () => {
  const { result, logs } = await captureConsole(() =>
    runReportCommand([...VALID_ARGS, "--json"], baseOptions()),
  );
  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.reportId, "smr_123");
  assert.equal(parsed.status, "received");
});

test("report malware surfaces backend api errors", async () => {
  const { result, errors } = await captureConsole(() =>
    runReportCommand(
      VALID_ARGS,
      baseOptions({
        submitMalwareReport: async () => {
          throw new ReportApiError(409, "already_reported", "report already exists");
        },
      }),
    ),
  );
  assert.equal(result, 1);
  assert.match(errors.join("\n"), /report already exists/);
});
