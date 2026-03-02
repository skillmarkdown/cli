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

test("resolveInstalledSkillsHostRoot builds canonical host root", () => {
  assert.equal(
    resolveInstalledSkillsHostRoot("/workspace/project", "https://registry.example.com"),
    "/workspace/project/.agent/skills/registry.skillmarkdown.com",
  );
});
