const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const {
  createEmptySkillsManifest,
  loadSkillsManifest,
  loadSkillsManifestOrEmpty,
  saveSkillsManifest,
  upsertSkillsManifestDependency,
} = requireDist("lib/workspace/skills-manifest.js");

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

test("loadSkillsManifest rejects non-object defaults", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            defaults: "openai",
            dependencies: {},
          }),
      }),
    /invalid skills manifest: defaults must be an object when provided/i,
  );
});

test("loadSkillsManifest rejects unknown defaults field", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            defaults: {
              agentTarget: "skillmd",
              profile: "dev",
            },
            dependencies: {},
          }),
      }),
    /invalid skills manifest: unknown defaults field 'profile'/i,
  );
});

test("loadSkillsManifest rejects invalid dependency shape", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            dependencies: {
              "@username/skill-a": "latest",
            },
          }),
      }),
    /invalid skills manifest: dependency '@username\/skill-a' must be an object/i,
  );
});

test("loadSkillsManifest rejects unknown dependency fields", async () => {
  await assert.rejects(
    () =>
      loadSkillsManifest("/workspace/project", {
        readFile: async () =>
          manifestJson({
            version: 1,
            dependencies: {
              "@username/skill-a": {
                spec: "latest",
                owner: "@username",
              },
            },
          }),
      }),
    /invalid skills manifest: dependency '@username\/skill-a' has unknown field 'owner'/i,
  );
});

test("loadSkillsManifest trims dependency spec values", async () => {
  const parsed = await loadSkillsManifest("/workspace/project", {
    readFile: async () =>
      manifestJson({
        version: 1,
        dependencies: {
          "@username/skill-a": {
            spec: "  latest  ",
          },
        },
      }),
  });

  assert.equal(parsed.dependencies[0].spec, "latest");
});

test("loadSkillsManifestOrEmpty returns an empty manifest when missing", async () => {
  const parsed = await loadSkillsManifestOrEmpty("/workspace/project", {
    readFile: async () => {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    },
  });

  assert.deepEqual(parsed, createEmptySkillsManifest());
});

test("upsertSkillsManifestDependency sorts and replaces by skill id", () => {
  const next = upsertSkillsManifestDependency(
    {
      version: 1,
      defaults: {},
      dependencies: [
        {
          skillId: "@username/skill-b",
          username: "username",
          skillSlug: "skill-b",
          spec: "latest",
        },
        {
          skillId: "@username/skill-a",
          username: "username",
          skillSlug: "skill-a",
          spec: "^1.0.0",
        },
      ],
    },
    {
      skillId: "@username/skill-b",
      username: "username",
      skillSlug: "skill-b",
      spec: "^2.0.0",
      agentTarget: "claude",
    },
  );

  assert.deepEqual(
    next.dependencies.map((dependency) => [
      dependency.skillId,
      dependency.spec,
      dependency.agentTarget,
    ]),
    [
      ["@username/skill-a", "^1.0.0", undefined],
      ["@username/skill-b", "^2.0.0", "claude"],
    ],
  );
});

test("saveSkillsManifest writes normalized dependency object payload", async () => {
  const writes = [];
  const renames = [];
  const mkdirs = [];

  await saveSkillsManifest(
    "/workspace/project",
    {
      version: 1,
      defaults: {
        agentTarget: "openai",
      },
      dependencies: [
        {
          skillId: "@username/skill-a",
          username: "username",
          skillSlug: "skill-a",
          spec: "latest",
          agentTarget: "claude",
        },
      ],
    },
    {
      mkdir: async (...args) => {
        mkdirs.push(args);
      },
      writeFile: async (...args) => {
        writes.push(args);
      },
      rename: async (...args) => {
        renames.push(args);
      },
    },
  );

  assert.equal(mkdirs.length, 1);
  assert.equal(writes.length, 1);
  assert.equal(renames.length, 1);
  const payload = JSON.parse(String(writes[0][1]));
  assert.deepEqual(payload, {
    version: 1,
    defaults: {
      agentTarget: "openai",
    },
    dependencies: {
      "@username/skill-a": {
        spec: "latest",
        agentTarget: "claude",
      },
    },
  });
});
