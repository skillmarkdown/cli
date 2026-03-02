const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const childProcess = require("node:child_process");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");
const {
  MINIMAL_SCAFFOLD_FILES,
  VERBOSE_SCAFFOLD_FILES,
} = require("../helpers/scaffold-expected.js");

const CLI_PATH = path.resolve(process.cwd(), "dist/cli.js");
const CLI_TEST_PREFIX = "skillmd-cli-integration-";

function runCli(args, cwd, envOverrides = {}) {
  return childProcess.spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: cwd,
      ...envOverrides,
    },
  });
}

function runCliAsync(args, cwd, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: {
        ...process.env,
        HOME: cwd,
        ...envOverrides,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        status: code,
        stdout,
        stderr,
      });
    });
  });
}

function writeSession(homeDir, session) {
  const sessionDir = path.join(homeDir, ".skillmd");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, "auth.json"), JSON.stringify(session, null, 2), "utf8");
}

function listScaffoldFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const nested = fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true });
      for (const nestedEntry of nested) {
        files.push(`${entry.name}/${nestedEntry.name}`);
      }
      continue;
    }

    files.push(entry.name);
  }

  return files.sort();
}

async function startMockRegistry(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

test("spawned CLI: init scaffolds and validates by default", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-skill");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init"], skillDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Initialized skill 'integration-skill'/);
    assert.match(result.stdout, /Validation passed: Spec validation passed\./);
    assert.deepEqual(listScaffoldFiles(skillDir), MINIMAL_SCAFFOLD_FILES);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: init with --template verbose scaffolds strict template", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-verbose");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init", "--template", "verbose"], skillDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Validation passed: Spec and strict scaffold validation passed\./);
    assert.deepEqual(listScaffoldFiles(skillDir), VERBOSE_SCAFFOLD_FILES);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: validate succeeds on generated skill", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-validate");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    const validateResult = runCli(["validate"], skillDir);
    assert.equal(validateResult.status, 0);
    assert.match(validateResult.stdout, /Validation passed: Spec validation passed\./);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: unknown command fails with usage", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["unknown"], root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Usage: skillmd <init\|validate\|login\|logout\|publish\|search\|history\|use>/,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: logout succeeds when no session exists", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["logout"], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No active session to log out\./);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: logout fails gracefully on malformed session path", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    fs.mkdirSync(path.join(root, ".skillmd", "auth.json"), { recursive: true });
    const result = runCli(["logout"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /skillmd logout:/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: login status reports not logged in by default", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["login", "--status"], root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Not logged in\./);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: init rejects unsupported args", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-args");

  try {
    fs.mkdirSync(skillDir);
    const result = runCli(["init", "--bad-flag"], skillDir);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Usage: skillmd init \[--no-validate\] \[--template <minimal\|verbose>\]/,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: publish --dry-run succeeds for verbose scaffold", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-publish-verbose");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--template", "verbose", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    writeSession(skillDir, {
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      email: "user@example.com",
      refreshToken: "refresh-token",
    });

    const publishResult = runCli(
      ["publish", "--version", "1.0.0", "--dry-run", "--json"],
      skillDir,
    );
    assert.equal(publishResult.status, 0);
    const parsed = JSON.parse(publishResult.stdout);
    assert.equal(parsed.status, "dry-run");
    assert.equal(parsed.skillId, "@core/integration-publish-verbose");
    assert.equal(parsed.version, "1.0.0");
    assert.equal(parsed.channel, "latest");
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: publish fails fast on invalid strict scaffold", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "integration-publish-minimal");

  try {
    fs.mkdirSync(skillDir);
    const initResult = runCli(["init", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    writeSession(skillDir, {
      provider: "github",
      uid: "uid-1",
      githubUsername: "core",
      refreshToken: "refresh-token",
    });

    const publishResult = runCli(["publish", "--version", "1.0.0", "--dry-run"], skillDir);
    assert.equal(publishResult.status, 1);
    assert.match(publishResult.stderr, /Validation failed/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: use fails with usage when skill-id is missing", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["use"], root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Usage: skillmd use <skill-id> \[--version <semver> \| --channel <latest\|beta>\] \[--allow-yanked\] \[--json\]/,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: search prints columnar human output", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const mockRegistry = await startMockRegistry((request, response) => {
    if (request.method === "GET" && request.url.startsWith("/v1/skills/search")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          query: "agent",
          limit: 2,
          results: [
            {
              skillId: "@core/agent-skill",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-skill",
              description: "Sample description for integration test output",
              channels: {
                latest: "1.0.0",
                beta: "1.1.0-beta.1",
              },
              updatedAt: "2026-03-02T09:00:00.000Z",
            },
          ],
          nextCursor: "cursor_2",
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "invalid_request", message: "not found" } }));
  });

  try {
    const result = await runCliAsync(["search", "agent", "--limit", "2"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^┌/mu);
    assert.match(result.stdout, /│ SKILL/mu);
    assert.match(result.stdout, /LATEST/mu);
    assert.match(result.stdout, /UPDATED/mu);
    assert.doesNotMatch(result.stdout, /BETA/mu);
    assert.match(result.stdout, /@core\//);
    assert.match(result.stdout, /2026-03-02T09:00/);
    assert.match(result.stdout, /Next page: skillmd search agent --limit 2 --cursor cursor_2/);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: history prints columnar human output", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const mockRegistry = await startMockRegistry((request, response) => {
    if (
      request.method === "GET" &&
      request.url.startsWith("/v1/skills/core/agent-skill/versions")
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@core",
          ownerLogin: "core",
          skill: "agent-skill",
          limit: 2,
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
          nextCursor: "cursor_3",
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "invalid_request", message: "not found" } }));
  });

  try {
    const result = await runCliAsync(["history", "@core/agent-skill", "--limit", "2"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^┌/mu);
    assert.match(result.stdout, /PUBLISHED/mu);
    assert.match(result.stdout, /DIGEST/mu);
    assert.match(result.stdout, /sha256:1234567890.*\.\.\./);
    assert.match(
      result.stdout,
      /Next page: skillmd history @core\/agent-skill --limit 2 --cursor cursor_3/,
    );
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});
