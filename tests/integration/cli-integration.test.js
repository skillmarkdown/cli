const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const childProcess = require("node:child_process");
const tar = require("tar");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");

const CLI_PATH = path.resolve(process.cwd(), "dist/cli.js");
const CLI_TEST_PREFIX = "skillmd-cli-integration-";
const CLI_PACKAGE_VERSION = require("../../package.json").version;

function writeAuthSession(homeDir, overrides = {}) {
  const sessionPath = path.join(homeDir, ".skillmd", "auth.json");
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    JSON.stringify(
      {
        provider: "email",
        uid: "uid-1",
        refreshToken: "refresh-token",
        projectId: "skillmarkdown-development",
        ...overrides,
      },
      null,
      2,
    ),
    "utf8",
  );
}

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

test("spawned CLI: publish --dry-run uses strict v1 fields", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "publish-skill");

  try {
    fs.mkdirSync(skillDir);
    runCli(["init", "--template", "verbose", "--no-validate"], skillDir);
    writeAuthSession(skillDir);
    const result = runCli(["publish", "--version", "1.0.0", "--dry-run"], skillDir, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /tag: latest/i);
    assert.match(result.stdout, /access: public/i);
    assert.match(result.stdout, /provenance: false/i);
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
      /Usage: skillmd use <skill-id> .*\[--version <semver> \| --spec <tag\|version\|range>\]/,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: list is wired and prints usage on invalid args", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["list", "--bad-flag"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: skillmd list/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: remove invalid skill id returns usage (no crash)", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["remove", "bad"], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: skillmd remove/);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: root --version prints package version", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["--version"], root);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), CLI_PACKAGE_VERSION);
    assert.notEqual(result.stdout.trim(), "0.0.0");
    assert.equal(result.stderr.trim(), "");
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: root -v prints package version", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const result = runCli(["-v"], root);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), CLI_PACKAGE_VERSION);
    assert.notEqual(result.stdout.trim(), "0.0.0");
    assert.equal(result.stderr.trim(), "");
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: root --version works with global auth token in any order", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    const first = runCli(
      ["--auth-token", "skmd_dev_tok_abc123abc123abc123abc123.secret", "--version"],
      root,
    );
    assert.equal(first.status, 0);
    assert.equal(first.stdout.trim(), CLI_PACKAGE_VERSION);
    assert.equal(first.stderr.trim(), "");

    const second = runCli(
      ["--version", "--auth-token", "skmd_dev_tok_abc123abc123abc123abc123.secret"],
      root,
    );
    assert.equal(second.status, 0);
    assert.equal(second.stdout.trim(), CLI_PACKAGE_VERSION);
    assert.equal(second.stderr.trim(), "");
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: search prints dist-tag latest and caches selection for numeric view", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/skills/search") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          query: "agent",
          limit: 20,
          results: [
            {
              skillId: "@username/skill-a",
              owner: "@owner",
              username: "username",
              skill: "skill-a",
              description: "A skill",
              distTags: { latest: "1.2.3" },
              updatedAt: "2026-03-02T12:00:00.000Z",
            },
          ],
          nextCursor: null,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/skills/username/skill-a") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "username",
          skill: "skill-a",
          description: "A skill",
          access: "public",
          distTags: { latest: "1.2.3" },
          updatedAt: "2026-03-02T12:00:00.000Z",
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });
  const baseUrl = mockRegistry.baseUrl;

  try {
    const searchResult = await runCliAsync(["search", "agent"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });
    assert.equal(searchResult.status, 0);
    assert.match(searchResult.stdout, /@username\/skill-a/);
    assert.match(searchResult.stdout, /1.2.3/);

    const viewResult = await runCliAsync(["view", "1"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });
    assert.equal(viewResult.status, 0);
    assert.match(viewResult.stdout, /Skill: @username\/skill-a/);
    assert.match(viewResult.stdout, /Dist-Tags:/);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: tag ls/add/rm manages dist-tags via strict v1 endpoints", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const distTags = {
    latest: "1.2.2",
  };

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/auth/whoami") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          uid: "uid-1",
          email: "core@example.com",
          owner: "@core",
          username: "core",
          projectId: "skillmarkdown-development",
          authType: "firebase",
          scope: "admin",
          plan: "pro",
          entitlements: { privateSkills: true },
        }),
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/skills/core/tag-skill/dist-tags") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@core",
          username: "core",
          skill: "tag-skill",
          distTags,
          updatedAt: "2026-03-03T12:00:00.000Z",
        }),
      );
      return;
    }

    if (request.method === "PUT" && url.pathname === "/v1/skills/core/tag-skill/dist-tags/beta") {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (parsed.version !== "1.2.3") {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(
            JSON.stringify({ error: { code: "invalid_request", message: "bad version" } }),
          );
          return;
        }
        distTags.beta = "1.2.3";
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            status: "updated",
            tag: "beta",
            version: "1.2.3",
            distTags,
          }),
        );
      });
      return;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === "/v1/skills/core/tag-skill/dist-tags/beta"
    ) {
      delete distTags.beta;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          status: "deleted",
          tag: "beta",
          distTags,
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });

  try {
    writeAuthSession(root, {
      projectId: "skillmarkdown-development",
    });

    const secureTokenMockPath = path.join(root, "mock-secure-token.cjs");
    fs.writeFileSync(
      secureTokenMockPath,
      [
        "const originalFetch = global.fetch;",
        "global.fetch = async (input, init) => {",
        "  const url = String(input);",
        "  if (url.startsWith('https://securetoken.googleapis.com/v1/token')) {",
        "    return new Response(JSON.stringify({",
        "      id_token: 'mock-id-token',",
        "      user_id: 'uid-1',",
        "      expires_in: '3600'",
        "    }), {",
        "      status: 200,",
        "      headers: { 'content-type': 'application/json' }",
        "    });",
        "  }",
        "  return originalFetch(input, init);",
        "};",
      ].join("\n"),
      "utf8",
    );

    const commonEnv = {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${secureTokenMockPath}`.trim(),
    };

    const listResult = await runCliAsync(
      ["tag", "ls", "@core/tag-skill", "--json"],
      root,
      commonEnv,
    );
    assert.equal(listResult.status, 0);
    const listed = JSON.parse(listResult.stdout);
    assert.equal(listed.distTags.latest, "1.2.2");

    const addResult = await runCliAsync(
      ["tag", "add", "@core/tag-skill@1.2.3", "beta", "--json"],
      root,
      commonEnv,
    );
    assert.equal(addResult.status, 0);
    const added = JSON.parse(addResult.stdout);
    assert.equal(added.status, "updated");
    assert.equal(added.distTags.beta, "1.2.3");

    const removeResult = await runCliAsync(
      ["tag", "rm", "@core/tag-skill", "beta", "--json"],
      root,
      commonEnv,
    );
    assert.equal(removeResult.status, 0);
    const removed = JSON.parse(removeResult.stdout);
    assert.equal(removed.status, "deleted");
    assert.equal(removed.distTags.beta, undefined);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: tag ls surfaces strict dist-tags route errors", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/skills/core/fallback-skill/dist-tags") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            code: "invalid_request",
            message: "route not found",
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });

  try {
    const env = {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_FIREBASE_API_KEY: "api-key",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    };

    const listResult = await runCliAsync(
      ["tag", "ls", "@core/fallback-skill", "--json"],
      root,
      env,
    );
    assert.equal(listResult.status, 1);
    assert.match(listResult.stderr, /route not found/i);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: update --all uses skills-lock.json and rewrites resolved version", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const installedPath = path.join(
    root,
    ".agent",
    "skills",
    "registry.skillmarkdown.com",
    "owner",
    "skill-a",
  );
  fs.mkdirSync(installedPath, { recursive: true });
  fs.writeFileSync(path.join(installedPath, "SKILL.md"), "---\nname: skill-a\n---\n", "utf8");

  const archive = await createSkillArchive(root, "skill-a-1.1.0", "skill-a");
  let baseUrl = "";
  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/username/skill-a/resolve" &&
      url.searchParams.get("spec") === "latest"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "username",
          skill: "skill-a",
          spec: "latest",
          version: "1.1.0",
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/username/skill-a/versions/1.1.0/artifact"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "username",
          skill: "skill-a",
          version: "1.1.0",
          digest: archive.digest,
          sizeBytes: archive.sizeBytes,
          mediaType: archive.mediaType,
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: `${baseUrl}/download/skill-a/1.1.0`,
          downloadExpiresAt: "2026-03-02T13:00:00.000Z",
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/download/skill-a/1.1.0") {
      response.writeHead(200, { "content-type": archive.mediaType });
      response.end(archive.bytes);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });
  baseUrl = mockRegistry.baseUrl;
  fs.writeFileSync(
    path.join(root, "skills-lock.json"),
    JSON.stringify(
      {
        lockfileVersion: 1,
        generatedAt: "2026-03-01T00:00:00.000Z",
        entries: {
          a: {
            skillId: "@username/skill-a",
            username: "username",
            skill: "skill-a",
            selectorSpec: "latest",
            resolvedVersion: "1.0.0",
            digest: "sha256:old",
            sizeBytes: 1,
            mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
            installedPath,
            registryBaseUrl: baseUrl,
            installedAt: "2026-03-01T00:00:00.000Z",
            sourceCommand: "skillmd use @username/skill-a",
            downloadedFrom: "https://storage.example.com",
            agentTarget: "skillmd",
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  try {
    const result = await runCliAsync(["update", "--all", "--json"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });

    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.updated.length, 1);
    assert.equal(payload.updated[0].toVersion, "1.1.0");

    const lock = JSON.parse(fs.readFileSync(path.join(root, "skills-lock.json"), "utf8"));
    const updated = Object.values(lock.entries)[0];
    assert.equal(updated.resolvedVersion, "1.1.0");
    assert.equal(updated.selectorSpec, "latest");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: install reads skills.json and writes skills-lock.json", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const archive = await createSkillArchive(root, "skill-a-1.2.3", "skill-a");
  let baseUrl = "";

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/username/skill-a/resolve" &&
      url.searchParams.get("spec") === "latest"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "username",
          skill: "skill-a",
          spec: "latest",
          version: "1.2.3",
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/username/skill-a/versions/1.2.3/artifact"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "username",
          skill: "skill-a",
          version: "1.2.3",
          digest: archive.digest,
          sizeBytes: archive.sizeBytes,
          mediaType: archive.mediaType,
          deprecated: false,
          deprecatedAt: null,
          deprecatedMessage: null,
          downloadUrl: `${baseUrl}/download/skill-a/1.2.3`,
          downloadExpiresAt: "2026-03-02T13:00:00.000Z",
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/download/skill-a/1.2.3") {
      response.writeHead(200, { "content-type": archive.mediaType });
      response.end(archive.bytes);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });
  baseUrl = mockRegistry.baseUrl;

  fs.writeFileSync(
    path.join(root, "skills.json"),
    JSON.stringify(
      {
        version: 1,
        defaults: {
          agentTarget: "skillmd",
        },
        dependencies: {
          "@username/skill-a": {
            spec: "latest",
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  try {
    const result = await runCliAsync(["install", "--json"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });

    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.total, 1);
    assert.equal(payload.installed.length, 1);
    assert.equal(payload.failed.length, 0);

    const lock = JSON.parse(fs.readFileSync(path.join(root, "skills-lock.json"), "utf8"));
    assert.equal(lock.lockfileVersion, 1);
    assert.equal(Object.keys(lock.entries).length, 1);
    const [entry] = Object.values(lock.entries);
    assert.equal(entry.skillId, "@username/skill-a");
    assert.equal(entry.selectorSpec, "latest");
    assert.equal(entry.resolvedVersion, "1.2.3");
    assert.equal(entry.sourceCommand, "skillmd install");

    const installedSkillPath = path.join(entry.installedPath, "SKILL.md");
    assert.equal(fs.existsSync(installedSkillPath), true);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: global --auth-token works with whoami", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  let seenAuthHeader = null;

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/auth/whoami") {
      seenAuthHeader = request.headers.authorization ?? null;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          uid: "uid-1",
          owner: "@core",
          username: "core",
          email: "core@example.com",
          projectId: "skillmarkdown-development",
          authType: "token",
          scope: "admin",
          plan: "pro",
          entitlements: {
            canUsePrivateSkills: true,
            canPublishPrivateSkills: true,
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });

  try {
    const result = await runCliAsync(
      ["--auth-token", "skmd_dev_tok_abc123abc123abc123abc123.secret", "whoami", "--json"],
      root,
      {
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
        SKILLMD_FIREBASE_API_KEY: "api-key",
        SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
      },
    );

    assert.equal(result.status, 0);
    assert.equal(seenAuthHeader, "Bearer skmd_dev_tok_abc123abc123abc123abc123.secret");
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.authType, "token");
    assert.equal(payload.scope, "admin");
    assert.equal(payload.plan, "pro");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: token ls works with command-position --auth-token", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  let seenAuthHeader = null;

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/v1/auth/tokens") {
      seenAuthHeader = request.headers.authorization ?? null;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          tokens: [
            {
              tokenId: "tok_abc123abc123abc123abc123",
              name: "ci",
              scope: "publish",
              createdAt: "2026-03-03T00:00:00.000Z",
              expiresAt: "2026-04-02T00:00:00.000Z",
            },
          ],
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });

  try {
    const result = await runCliAsync(
      ["token", "ls", "--json", "--auth-token", "skmd_dev_tok_abc123abc123abc123abc123.secret"],
      root,
      {
        SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
        SKILLMD_FIREBASE_API_KEY: "api-key",
        SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
      },
    );

    assert.equal(result.status, 0);
    assert.equal(seenAuthHeader, "Bearer skmd_dev_tok_abc123abc123abc123abc123.secret");
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.tokens.length, 1);
    assert.equal(payload.tokens[0].name, "ci");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});
