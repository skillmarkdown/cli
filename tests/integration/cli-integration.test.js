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

function writeAuthSession(homeDir, overrides = {}) {
  const sessionPath = path.join(homeDir, ".skillmd", "auth.json");
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    JSON.stringify(
      {
        provider: "github",
        uid: "uid-1",
        githubUsername: "core",
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
      SKILLMD_GITHUB_CLIENT_ID: "github-client-id",
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
      /Usage: skillmd use <skill-id> \[--version <semver> \| --spec <tag\|version\|range>\]/,
    );
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
              skillId: "@owner/skill-a",
              owner: "@owner",
              ownerLogin: "owner",
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

    if (request.method === "GET" && url.pathname === "/v1/skills/owner/skill-a") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
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
    assert.match(searchResult.stdout, /@owner\/skill-a/);
    assert.match(searchResult.stdout, /1.2.3/);

    const viewResult = await runCliAsync(["view", "1"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });
    assert.equal(viewResult.status, 0);
    assert.match(viewResult.stdout, /Skill: @owner\/skill-a/);
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
    if (request.method === "GET" && url.pathname === "/v1/skills/core/tag-skill/dist-tags") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@core",
          ownerLogin: "core",
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
      githubUsername: "core",
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
      SKILLMD_GITHUB_CLIENT_ID: "github-client-id",
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

test("spawned CLI: tag ls falls back to skill view when dist-tags route is unavailable", async () => {
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

    if (request.method === "GET" && url.pathname === "/v1/skills/core/fallback-skill") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@core",
          ownerLogin: "core",
          skill: "fallback-skill",
          description: "fallback",
          access: "public",
          distTags: {
            latest: "3.0.0",
          },
          updatedAt: "2026-03-03T12:00:00.000Z",
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
      SKILLMD_GITHUB_CLIENT_ID: "github-client-id",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
    };

    const listResult = await runCliAsync(
      ["tag", "ls", "@core/fallback-skill", "--json"],
      root,
      env,
    );
    assert.equal(listResult.status, 0);
    const listed = JSON.parse(listResult.stdout);
    assert.equal(listed.skill, "fallback-skill");
    assert.equal(listed.distTags.latest, "3.0.0");
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
      url.pathname === "/v1/skills/owner/skill-a/resolve" &&
      url.searchParams.get("spec") === "latest"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          ownerLogin: "owner",
          skill: "skill-a",
          spec: "latest",
          version: "1.1.0",
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
            skillId: "@owner/skill-a",
            ownerLogin: "owner",
            skill: "skill-a",
            selectorSpec: "latest",
            resolvedVersion: "1.0.0",
            digest: "sha256:old",
            sizeBytes: 1,
            mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
            installedPath,
            registryBaseUrl: baseUrl,
            installedAt: "2026-03-01T00:00:00.000Z",
            sourceCommand: "skillmd use @owner/skill-a",
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
