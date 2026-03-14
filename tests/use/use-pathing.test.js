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

test("resolveInstalledSkillPath builds project-local skill path", () => {
  const path = resolveInstalledSkillPath(
    "/workspace/project",
    "https://registryapi-sm46rm3rja-uc.a.run.app/",
    "stefdevscore",
    "pagetest-01",
  );
  assert.equal(path, "/workspace/project/.agent/skills/pagetest-01");
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
    "/workspace/project/.agent/skills",
  );
});

test("resolveInstalledSkillsHostRoot supports provider-specific roots", () => {
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com", "claude"),
    "/workspace/project/.claude/skills",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com", "gemini"),
    "/workspace/project/.gemini/skills",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com", "meta"),
    "/workspace/project/.meta/skills",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot(
      "/workspace/project",
      "https://registry.example.com",
      "perplexity",
    ),
    "/workspace/project/.perplexity/skills",
  );
  assert.equal(
    resolveInstalledSkillsHostRoot(
      "/workspace/project",
      "https://registry.example.com",
      "custom:myagent",
    ),
    "/workspace/project/.agents/skills/myagent",
  );
});

test("resolveInstalledSkillPath supports global builtin homes", () => {
  assert.equal(
    resolveInstalledSkillPath(
      "/workspace/project",
      "https://registry.example.com",
      "stefdevscore",
      "pagetest-01",
      "openai",
      { scope: "global", homeDir: "/Users/tester" },
    ),
    "/Users/tester/.codex/skills/pagetest-01",
  );
  assert.equal(
    resolveInstalledSkillPath(
      "/workspace/project",
      "https://registry.example.com",
      "stefdevscore",
      "pagetest-01",
      "claude",
      { scope: "global", homeDir: "/Users/tester" },
    ),
    "/Users/tester/.claude/skills/pagetest-01",
  );
});

test("resolveInstalledSkillPath maps known global aliases to canonical homes", () => {
  assert.equal(
    resolveInstalledSkillPath(
      "/workspace/project",
      "https://registry.example.com",
      "stefdevscore",
      "pagetest-01",
      "custom:chatgpt",
      { scope: "global", homeDir: "/Users/tester" },
    ),
    "/Users/tester/.codex/skills/pagetest-01",
  );
  assert.equal(
    resolveInstalledSkillPath(
      "/workspace/project",
      "https://registry.example.com",
      "stefdevscore",
      "pagetest-01",
      "custom:anthropic",
      { scope: "global", homeDir: "/Users/tester" },
    ),
    "/Users/tester/.claude/skills/pagetest-01",
  );
});

test("resolveInstalledSkillPath keeps unknown custom targets under .agents globally", () => {
  assert.equal(
    resolveInstalledSkillPath(
      "/workspace/project",
      "https://registry.example.com",
      "stefdevscore",
      "pagetest-01",
      "custom:myagent",
      { scope: "global", homeDir: "/Users/tester" },
    ),
    "/Users/tester/.agents/skills/myagent/pagetest-01",
  );
});

test("resolveInstallTempRoot supports global provider and alias temp roots", () => {
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "openai", {
      scope: "global",
      homeDir: "/Users/tester",
    }),
    "/Users/tester/.codex/.tmp",
  );
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "custom:google", {
      scope: "global",
      homeDir: "/Users/tester",
    }),
    "/Users/tester/.gemini/.tmp",
  );
  assert.equal(
    resolveInstallTempRoot("/workspace/project", "custom:myagent", {
      scope: "global",
      homeDir: "/Users/tester",
    }),
    "/Users/tester/.agents/.tmp/myagent",
  );
});
