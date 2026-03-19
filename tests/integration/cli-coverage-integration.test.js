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
const CLI_TEST_PREFIX = "skillmd-cli-coverage-";

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

async function runCliAsync(args, cwd, envOverrides = {}) {
  return await new Promise((resolve, reject) => {
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
      resolve({ status: code, stdout, stderr });
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

test("spawned CLI: logout removes session file", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);

  try {
    writeAuthSession(root);
    const sessionPath = path.join(root, ".skillmd", "auth.json");
    assert.equal(fs.existsSync(sessionPath), true);

    const result = runCli(["logout"], root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Logged out/i);
    assert.equal(fs.existsSync(sessionPath), false);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: remove deletes installed skill and updates lockfile", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  let baseUrl = "";
  const archive = await createSkillArchive(root, "skill-a-1.2.3", "skill-a");

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/skill-a/resolve" &&
      url.searchParams.get("spec") === "latest"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "owner",
          skill: "skill-a",
          spec: "latest",
          version: "1.2.3",
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/skills/skill-a/versions/1.2.3/artifact") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@owner",
          username: "owner",
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

  try {
    fs.writeFileSync(
      path.join(root, "skills.json"),
      JSON.stringify(
        {
          version: 1,
          defaults: {
            agentTarget: "skillmd",
          },
          dependencies: {
            "skill-a": {
              spec: "latest",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const installResult = await runCliAsync(["install", "--json"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });
    assert.equal(installResult.status, 0, installResult.stderr);

    const lockBefore = JSON.parse(fs.readFileSync(path.join(root, "skills-lock.json"), "utf8"));
    const [entryBefore] = Object.values(lockBefore.entries);
    const installedPath = entryBefore.installedPath;
    assert.equal(fs.existsSync(path.join(installedPath, "SKILL.md")), true);

    const result = runCli(["remove", "skill-a", "--json"], root, {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: baseUrl,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.removed, 1);
    assert.equal(fs.existsSync(installedPath), false);

    const lock = JSON.parse(fs.readFileSync(path.join(root, "skills-lock.json"), "utf8"));
    assert.equal(Object.keys(lock.entries).length, 0);
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: validate parity passes with skills-ref on PATH", () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const skillDir = path.join(root, "parity-skill");
  const binDir = path.join(root, "bin");

  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });

    const initResult = runCli(["init", "--template", "verbose", "--no-validate"], skillDir);
    assert.equal(initResult.status, 0);

    const skillsRefPath = path.join(binDir, "skills-ref");
    fs.writeFileSync(
      skillsRefPath,
      '#!/bin/sh\nif [ "$1" = "validate" ]; then\n  echo "skills-ref validation passed"\n  exit 0\nfi\nexit 1\n',
      "utf8",
    );
    fs.chmodSync(skillsRefPath, 0o755);

    const result = runCli(["validate", skillDir, "--parity"], root, {
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Validation parity passed/i);
  } finally {
    cleanupDirectory(root);
  }
});

test("spawned CLI: history deprecate and unpublish support scoped org skills", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const version = "1.2.3";
  const skillId = "@core/skill-a";
  let deprecated = false;
  let unpublished = false;

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (
      request.method === "GET" &&
      url.pathname === "/v1/skills/@core/skill-a/versions" &&
      url.searchParams.get("limit") === "5"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          owner: "@core",
          username: "core",
          skill: "skill-a",
          limit: 5,
          results: unpublished
            ? []
            : [
                {
                  version,
                  publishedAt: "2026-03-02T12:00:00.000Z",
                  access: "public",
                  digest: "sha256:test",
                  sizeBytes: 1,
                  deprecated,
                  deprecatedAt: deprecated ? "2026-03-03T00:00:00.000Z" : null,
                  deprecatedMessage: deprecated ? "Use a newer version" : null,
                  distTags: deprecated ? {} : { latest: version },
                },
              ],
          nextCursor: null,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/skills/@core/skill-a/deprecations") {
      deprecated = true;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          status: "updated",
          range: version,
          affectedVersions: [version],
          message: "Use a newer version",
        }),
      );
      return;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === `/v1/skills/@core/skill-a/versions/${version}`
    ) {
      unpublished = true;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          status: "unpublished",
          version,
          tombstoned: true,
          removedTags: ["latest"],
          distTags: {},
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
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      SKILLMD_FIREBASE_API_KEY: "api-key",
    };

    const historyResult = await runCliAsync(
      ["history", skillId, "--limit", "5", "--json"],
      root,
      env,
    );
    assert.equal(historyResult.status, 0);
    const historyPayload = JSON.parse(historyResult.stdout);
    assert.equal(historyPayload.results[0].version, version);

    const deprecateResult = await runCliAsync(
      ["deprecate", `${skillId}@${version}`, "--message", "Use a newer version", "--json"],
      root,
      env,
    );
    assert.equal(deprecateResult.status, 0);
    const deprecatePayload = JSON.parse(deprecateResult.stdout);
    assert.equal(deprecatePayload.status, "updated");

    const unpublishResult = await runCliAsync(
      ["unpublish", `${skillId}@${version}`, "--json"],
      root,
      env,
    );
    assert.equal(unpublishResult.status, 0);
    const unpublishPayload = JSON.parse(unpublishResult.stdout);
    assert.equal(unpublishPayload.status, "unpublished");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: token add and rm work with auth token", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  let created = false;
  const tokenId = "tok_abc123abc123abc123abc123";

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "POST" && url.pathname === "/v1/auth/tokens") {
      created = true;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          tokenId,
          token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
          name: "ci",
          scope: "admin",
          createdAt: "2026-03-03T00:00:00.000Z",
          expiresAt: "2026-03-10T00:00:00.000Z",
        }),
      );
      return;
    }

    if (request.method === "DELETE" && url.pathname === `/v1/auth/tokens/${tokenId}`) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "revoked", tokenId }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });

  try {
    const env = {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      SKILLMD_FIREBASE_API_KEY: "api-key",
    };

    const addResult = await runCliAsync(
      ["token", "add", "ci", "--scope", "admin", "--days", "7", "--json"],
      root,
      env,
    );
    assert.equal(addResult.status, 0);
    assert.equal(created, true);

    const removeResult = await runCliAsync(["token", "rm", tokenId, "--json"], root, env);
    assert.equal(removeResult.status, 0);
    const payload = JSON.parse(removeResult.stdout);
    assert.equal(payload.status, "revoked");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});

test("spawned CLI: org ls and org tokens work with auth token", async () => {
  const root = makeTempDirectory(CLI_TEST_PREFIX);
  const orgSlug = "acme";
  const tokenId = "tok_abc123abc123abc123abc123";

  const mockRegistry = await startMockRegistry((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/v1/auth/whoami") {
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
          organizations: [{ slug: orgSlug, owner: "@acme", role: "admin" }],
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === `/v1/organizations/${orgSlug}/tokens`) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          tokenId,
          token: "skmd_dev_tok_abc123abc123abc123abc123.secret",
          name: "deploy",
          scope: "admin",
          createdAt: "2026-03-03T00:00:00.000Z",
          expiresAt: "2026-03-10T00:00:00.000Z",
        }),
      );
      return;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === `/v1/organizations/${orgSlug}/tokens/${tokenId}`
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "revoked", tokenId }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "not found" } }));
  });

  try {
    const env = {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: mockRegistry.baseUrl,
      SKILLMD_AUTH_TOKEN: "skmd_dev_tok_abc123abc123abc123abc123.secret",
      SKILLMD_FIREBASE_API_KEY: "api-key",
    };

    const listResult = await runCliAsync(["org", "ls", "--json"], root, env);
    assert.equal(listResult.status, 0);
    const listPayload = JSON.parse(listResult.stdout);
    assert.equal(listPayload.organizations[0].slug, orgSlug);

    const addResult = await runCliAsync(
      ["org", "tokens", "add", orgSlug, "deploy", "--scope", "admin", "--days", "7", "--json"],
      root,
      env,
    );
    assert.equal(addResult.status, 0);

    const removeResult = await runCliAsync(
      ["org", "tokens", "rm", orgSlug, tokenId, "--json"],
      root,
      env,
    );
    assert.equal(removeResult.status, 0);
    const removePayload = JSON.parse(removeResult.stdout);
    assert.equal(removePayload.status, "revoked");
  } finally {
    await mockRegistry.close();
    cleanupDirectory(root);
  }
});
