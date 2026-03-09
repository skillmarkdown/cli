const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { loadSkillsManifest } = requireDist("lib/workspace/skills-manifest.js");

function manifestJson(value) {
  return JSON.stringify(value, null, 2);
}

test("loadSkillsManifest parses valid manifest and sorts dependencies", async () => {
  const parsed = await loadSkillsManifest("/workspace/project", {
    readFile: async () =>
      manifestJson({
        version: 1,
        defaults: {
          agentTarget: "skillmd",
        },
        dependencies: {
          "@username/skill-b": {
            spec: "^1.2.0",
          },
          "@username/skill-a": {
            spec: "latest",
            agentTarget: "claude",
          },
        },
      }),
  });

  assert.equal(parsed.version, 1);
  assert.equal(parsed.defaults.agentTarget, "skillmd");
  assert.deepEqual(
    parsed.dependencies.map((dependency) => dependency.skillId),
    ["@username/skill-a", "@username/skill-b"],
  );
  assert.equal(parsed.dependencies[0].agentTarget, "claude");
});

test("loadSkillsManifest accepts new builtin agent targets", async () => {
  const parsed = await loadSkillsManifest("/workspace/project", {
    readFile: async () =>
      manifestJson({
        version: 1,
        defaults: {
          agentTarget: "openai",
        },
        dependencies: {
          "@username/skill-a": {
            spec: "latest",
            agentTarget: "perplexity",
          },
        },
      }),
  });

  assert.equal(parsed.defaults.agentTarget, "openai");
  assert.equal(parsed.dependencies[0].agentTarget, "perplexity");
});

test("loadSkillsManifest rejects unknown top-level fields", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            dependencies: {
              "@username/skill-a": { spec: "latest" },
            },
            extra: true,
          }),
      }),
    /invalid skills manifest: unknown top-level field 'extra'/i,
  );
});

test("loadSkillsManifest rejects missing dependencies", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            defaults: {
              agentTarget: "skillmd",
            },
          }),
      }),
    /invalid skills manifest: dependencies must be an object/i,
  );
});

test("loadSkillsManifest rejects non-canonical dependency key", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            dependencies: {
              "username/skill-a": { spec: "latest" },
            },
          }),
      }),
    /invalid skills manifest: dependency key 'username\/skill-a' must be canonical/i,
  );
});

test("loadSkillsManifest rejects invalid dependency agentTarget", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            dependencies: {
              "@username/skill-a": { spec: "latest", agentTarget: "custom:UPPER" },
            },
          }),
      }),
    /invalid skills manifest: dependency '@username\/skill-a'.agentTarget must be a valid agent target/i,
  );
});

test("loadSkillsManifest rejects malformed JSON", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () => "{",
      }),
    /invalid skills manifest: skills.json contains malformed JSON/i,
  );
});
