const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveRegistryHost, resolveInstalledSkillPath, resolveInstallTempRoot } =
  requireDist("lib/use/pathing.js");

test("resolveRegistryHost normalizes host casing", () => {
  const host = resolveRegistryHost("https://RegistryAPI-SM46RM3RJA-UC.A.RUN.APP");
  assert.equal(host, "registryapi-sm46rm3rja-uc.a.run.app");
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
    "/workspace/project/.agent/skills/registryapi-sm46rm3rja-uc.a.run.app/stefdevscore/pagetest-01",
  );
});

test("resolveInstallTempRoot builds .agent temp root", () => {
  assert.equal(resolveInstallTempRoot("/workspace/project"), "/workspace/project/.agent/.tmp");
});
