const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const childProcess = require("node:child_process");
const tar = require("tar");

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

async function createSkillArchive(root, folderName, skillName) {
  const sourceDir = path.join(root, ".archive-src", folderName);
  const archiveDir = path.join(root, ".archive-dist");
  const archivePath = path.join(archiveDir, `${folderName}.tgz`);

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, "SKILL.md"),
    `---\nname: ${skillName}\n---\n\n# ${skillName}\n`,
    "utf8",
  );

  await tar.c({ gzip: true, file: archivePath, cwd: sourceDir }, ["."]);
  const bytes = fs.readFileSync(archivePath);
  return {
    bytes,
    digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    sizeBytes: bytes.length,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
  };
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
      /Usage: skillmd <init\|validate\|login\|logout\|publish\|search\|view\|history\|use\|update>/,
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

test("spawned CLI: view fails with usage when skill-id is missing", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["view"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: skillmd view <skill-id\|index> \[--json\]/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: search --scope private requires login", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["search", "agent", "--scope", "private"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /private scope requires login/i);
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
    assert.match(result.stdout, /│\s*#\s*│\s*SKILL/mu);
    assert.match(result.stdout, /LATEST/mu);
    assert.match(result.stdout, /UPDATED/mu);
    assert.doesNotMatch(result.stdout, /BETA/mu);
    assert.match(result.stdout, /│\s*1\s*│\s*@core\//mu);
    assert.match(result.stdout, /@core\//);
    assert.match(result.stdout, /2026-03-02T09:00/);
    assert.match(result.stdout, /Next page: skillmd search agent --limit 2 --cursor cursor_2/);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: search row numbers continue across cursor pages", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/search" &&
      url.searchParams.get("q") === "agent"
    ) {
      const cursor = url.searchParams.get("cursor");
      response.writeHead(200, { "content-type": "application/json" });

      if (!cursor) {
        response.end(
          JSON.stringify({
            query: "agent",
            limit: 1,
            results: [
              {
                skillId: "@core/agent-skill-1",
                owner: "@core",
                ownerLogin: "core",
                skill: "agent-skill-1",
                description: "first page",
                channels: {
                  latest: "1.0.0",
                },
                updatedAt: "2026-03-02T09:00:00.000Z",
              },
            ],
            nextCursor: "cursor_2",
          }),
        );
        return;
      }

      response.end(
        JSON.stringify({
          query: "agent",
          limit: 1,
          results: [
            {
              skillId: "@core/agent-skill-2",
              owner: "@core",
              ownerLogin: "core",
              skill: "agent-skill-2",
              description: "second page",
              channels: {
                latest: "1.0.1",
              },
              updatedAt: "2026-03-02T09:01:00.000Z",
            },
          ],
          nextCursor: null,
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "invalid_request", message: "not found" } }));
  });

  try {
    const env = {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    };
    const pageOne = await runCliAsync(["search", "agent", "--limit", "1"], root, env);
    assert.equal(pageOne.status, 0);
    assert.match(pageOne.stdout, /│\s*1\s*│\s*@core\/agent-skill-1/mu);
    assert.match(pageOne.stdout, /Next page: skillmd search agent --limit 1 --cursor cursor_2/);

    const pageTwo = await runCliAsync(
      ["search", "agent", "--limit", "1", "--cursor", "cursor_2"],
      root,
      env,
    );
    assert.equal(pageTwo.status, 0);
    assert.match(pageTwo.stdout, /│\s*2\s*│\s*@core\/agent-skill-2/mu);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: view resolves numeric index from cached search results", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const mockRegistry = await startMockRegistry((request, response) => {
    if (request.method === "GET" && request.url === "/v1/skills/core/agent-skill") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@core",
          ownerLogin: "core",
          skill: "agent-skill",
          description: "Sample description for integration test output",
          visibility: "public",
          channels: {
            latest: "1.0.0",
          },
          updatedAt: "2026-03-02T09:00:00.000Z",
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "invalid_request", message: "not found" } }));
  });

  try {
    const skillmdDir = path.join(root, ".skillmd");
    fs.mkdirSync(skillmdDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillmdDir, "search-cache.json"),
      JSON.stringify(
        {
          registryBaseUrl: mockRegistry.baseUrl,
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@core/agent-skill"],
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = await runCliAsync(["view", "1"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Skill: @core\/agent-skill/);
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

test("spawned CLI: update --all updates installed skills", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const installedRoot = path.join(root, ".agent", "skills", "registry.skillmarkdown.com", "owner");
  fs.mkdirSync(path.join(installedRoot, "skill-a"), { recursive: true });
  fs.mkdirSync(path.join(installedRoot, "skill-b"), { recursive: true });
  fs.writeFileSync(
    path.join(installedRoot, "skill-a", ".skillmd-install.json"),
    JSON.stringify(
      {
        skillId: "@owner/skill-a",
        version: "1.0.0",
        sourceCommand: "skillmd use @owner/skill-a",
        installIntent: {
          strategy: "latest_fallback_beta",
          value: null,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(installedRoot, "skill-b", ".skillmd-install.json"),
    JSON.stringify(
      {
        skillId: "@owner/skill-b",
        version: "2.0.0-beta.1",
        sourceCommand: "skillmd use @owner/skill-b --channel beta",
        installIntent: {
          strategy: "channel",
          value: "beta",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const archiveA = await createSkillArchive(root, "skill-a-1.1.0", "skill-a");
  const archiveB = await createSkillArchive(root, "skill-b-2.0.0-beta.2", "skill-b");

  let baseUrl = "";
  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-a/resolve" &&
      url.searchParams.get("channel") === "latest"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-a",
          channel: "latest",
          version: "1.1.0",
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-b/resolve" &&
      url.searchParams.get("channel") === "beta"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-b",
          channel: "beta",
          version: "2.0.0-beta.2",
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-a/versions/1.1.0/artifact"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-a",
          version: "1.1.0",
          digest: archiveA.digest,
          sizeBytes: archiveA.sizeBytes,
          mediaType: archiveA.mediaType,
          yanked: false,
          yankedAt: null,
          yankedReason: null,
          downloadUrl: `${baseUrl}/download/skill-a/1.1.0`,
          downloadExpiresAt: "2026-03-02T13:00:00.000Z",
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-b/versions/2.0.0-beta.2/artifact"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-b",
          version: "2.0.0-beta.2",
          digest: archiveB.digest,
          sizeBytes: archiveB.sizeBytes,
          mediaType: archiveB.mediaType,
          yanked: false,
          yankedAt: null,
          yankedReason: null,
          downloadUrl: `${baseUrl}/download/skill-b/2.0.0-beta.2`,
          downloadExpiresAt: "2026-03-02T13:00:00.000Z",
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/download/skill-a/1.1.0") {
      response.writeHead(200, { "content-type": archiveA.mediaType });
      response.end(archiveA.bytes);
      return;
    }

    if (request.method === "GET" && url.pathname === "/download/skill-b/2.0.0-beta.2") {
      response.writeHead(200, { "content-type": archiveB.mediaType });
      response.end(archiveB.bytes);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "invalid_request", message: "not found" } }));
  });
  baseUrl = mockRegistry.baseUrl;

  try {
    const result = await runCliAsync(["update", "--all", "--json"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    });

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.mode, "all");
    assert.equal(parsed.updated.length, 2);
    assert.equal(parsed.failed.length, 0);

    const updatedSkillAMetadata = JSON.parse(
      fs.readFileSync(path.join(installedRoot, "skill-a", ".skillmd-install.json"), "utf8"),
    );
    const updatedSkillBMetadata = JSON.parse(
      fs.readFileSync(path.join(installedRoot, "skill-b", ".skillmd-install.json"), "utf8"),
    );
    assert.equal(updatedSkillAMetadata.version, "1.1.0");
    assert.equal(updatedSkillAMetadata.installIntent.strategy, "latest_fallback_beta");
    assert.equal(updatedSkillBMetadata.version, "2.0.0-beta.2");
    assert.equal(updatedSkillBMetadata.installIntent.strategy, "channel");
    assert.equal(updatedSkillBMetadata.installIntent.value, "beta");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: update continues when one skill fails", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const installedRoot = path.join(root, ".agent", "skills", "registry.skillmarkdown.com", "owner");
  fs.mkdirSync(path.join(installedRoot, "skill-a"), { recursive: true });
  fs.mkdirSync(path.join(installedRoot, "skill-b"), { recursive: true });
  fs.writeFileSync(
    path.join(installedRoot, "skill-a", ".skillmd-install.json"),
    JSON.stringify(
      {
        skillId: "@owner/skill-a",
        version: "1.0.0",
        sourceCommand: "skillmd use @owner/skill-a",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(installedRoot, "skill-b", ".skillmd-install.json"),
    JSON.stringify(
      {
        skillId: "@owner/skill-b",
        version: "2.0.0-beta.1",
        sourceCommand: "skillmd use @owner/skill-b --channel beta",
      },
      null,
      2,
    ),
    "utf8",
  );

  const archiveB = await createSkillArchive(root, "skill-b-2.0.0-beta.2", "skill-b");

  let baseUrl = "";
  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-a/resolve" &&
      url.searchParams.get("channel") === "latest"
    ) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            code: "invalid_request",
            message: "channel not set for skill",
          },
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-b/resolve" &&
      url.searchParams.get("channel") === "beta"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-b",
          channel: "beta",
          version: "2.0.0-beta.2",
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/owner/skill-b/versions/2.0.0-beta.2/artifact"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-b",
          version: "2.0.0-beta.2",
          digest: archiveB.digest,
          sizeBytes: archiveB.sizeBytes,
          mediaType: archiveB.mediaType,
          yanked: false,
          yankedAt: null,
          yankedReason: null,
          downloadUrl: `${baseUrl}/download/skill-b/2.0.0-beta.2`,
          downloadExpiresAt: "2026-03-02T13:00:00.000Z",
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/download/skill-b/2.0.0-beta.2") {
      response.writeHead(200, { "content-type": archiveB.mediaType });
      response.end(archiveB.bytes);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "invalid_request", message: "not found" } }));
  });
  baseUrl = mockRegistry.baseUrl;

  try {
    const result = await runCliAsync(["update", "--all", "--json"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    });

    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.updated.length, 1);
    assert.equal(parsed.failed.length, 1);
    assert.match(parsed.failed[0].reason, /(channel not set for skill|not found)/i);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});
