const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const {
  resolveRegistryHost,
  resolveInstalledSkillPath,
  resolveInstallTempRoot,
  resolveInstalledSkillsHostRoot,
} = requireDist("lib/use/pathing.js");

test("resolveRegistryHost always returns canonical install host", () => {
  const host = resolveRegistryHost("https://RegistryAPI-SM46RM3RJA-UC.A.RUN.APP");
  assert.equal(host, "registry.skillmarkdown.com");
});

test("resolveInstalledSkillPath builds project-local host/owner/skill path", () => {
  const path = resolveInstalledSkillPath(
    "/workspace/project",
    "https://registryapi-sm46rm3rja-uc.a.run.app/",
    "stefdevscore",
    "pagetest-01",
  );
  assert.equal(
    path,
    "/workspace/project/.agent/skills/registry.skillmarkdown.com/stefdevscore/pagetest-01",
  );
});

test("resolveInstallTempRoot builds .agent temp root", () => {
  assert.equal(resolveInstallTempRoot("/workspace/project"), "/workspace/project/.agent/.tmp");
});

test("resolveInstallTempRoot supports provider-specific temp roots", () => {
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "claude"),
    "/workspace/project/.claude/.tmp",
  );
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "gemini"),
    "/workspace/project/.gemini/.tmp",
  );
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "openai"),
    "/workspace/project/.openai/.tmp",
  );
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "deepseek"),
    "/workspace/project/.deepseek/.tmp",
  );
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "custom:myagent"),
    "/workspace/project/.agents/.tmp/myagent",
  );
});

test("resolveInstalledSkillsHostRoot builds canonical host root", () => {
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com"),
    "/workspace/project/.agent/skills/registry.skillmarkdown.com",
  );
});

test("resolveInstalledSkillsHostRoot supports provider-specific roots", () => {
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com", "claude"),
    "/workspace/project/.claude/skills/registry.skillmarkdown.com",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com", "gemini"),
    "/workspace/project/.gemini/skills/registry.skillmarkdown.com",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com", "meta"),
    "/workspace/project/.meta/skills/registry.skillmarkdown.com",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot(
      "/workspace/project",
      "https://registry.example.com",
      "perplexity",
    ),
    "/workspace/project/.perplexity/skills/registry.skillmarkdown.com",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot(
      "/workspace/project",
      "https://registry.example.com",
      "custom:myagent",
    ),
    "/workspace/project/.agents/skills/myagent/registry.skillmarkdown.com",
  );
});
