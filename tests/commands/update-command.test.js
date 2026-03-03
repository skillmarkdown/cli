const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const { captureConsole } = require("../helpers/console-test-utils.js");

const { runUpdateCommand } = requireDist("commands/update.js");
const { UseApiError } = requireDist("lib/use/errors.js");

function makeTarget(skillId, agentTarget = "skillmd") {
  const normalized = skillId.replace(/^@/, "").toLowerCase();
  const [ownerSlug, skillSlug] = normalized.split("/");
  const skillsRoot =
    agentTarget === "claude"
      ? ".claude/skills"
      : agentTarget === "gemini"
        ? ".gemini/skills"
        : agentTarget.startsWith("custom:")
          ? `.agents/skills/${agentTarget.slice("custom:".length)}`
          : ".agent/skills";
  return {
    skillId: `@${ownerSlug}/${skillSlug}`,
    ownerSlug,
    skillSlug,
    agentTarget,
    installedPath: `/workspace/project/${skillsRoot}/registry.skillmarkdown.com/${ownerSlug}/${skillSlug}`,
  };
}

function baseOptions(overrides = {}) {
  return {
    cwd: "/workspace/project",
    env: {
      SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
      SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
      SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
    },
    now: () => new Date("2026-03-02T12:34:56.000Z"),
    getConfig: () => ({
      firebaseProjectId: "skillmarkdown-development",
      registryBaseUrl: "https://registry.example.com",
      requestTimeoutMs: 10000,
      defaultAgentTarget: "skillmd",
    }),
    discoverInstalledSkills: async () => [],
    discoverInstalledSkillsAcrossTargets: async () => [],
    readInstalledSkillMetadata: async () => null,
    installFromRegistry: async () => ({
      result: {
        skillId: "@owner/skill",
        ownerLogin: "owner",
        skill: "skill",
        version: "1.2.3",
        digest: "sha256:test",
        sizeBytes: 5,
        mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
        installedPath: "/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/skill",
        registryBaseUrl: "https://registry.example.com",
        installedAt: "2026-03-02T12:34:56.000Z",
        source: "registry",
        agentTarget: "skillmd",
      },
      metadata: {
        skillId: "@owner/skill",
      },
    }),
    access: async () => {},
    resolveReadIdToken: async () => null,
    ...overrides,
  };
}

test("fails with usage on invalid args", async () => {
  const exitCode = await runUpdateCommand(["--all", "@owner/skill"]);
  assert.equal(exitCode, 1);
});

test("treats no args and --all as all mode", async () => {
  const discoverAcrossCalls = [];
  const discoverInstalledSkills = async (_cwd, _registryBaseUrl, agentTarget) => {
    void agentTarget;
    return [];
  };
  const discoverInstalledSkillsAcrossTargets = async () => {
    discoverAcrossCalls.push("all");
    return [];
  };

  const first = await captureConsole(() =>
    runUpdateCommand(
      [],
      baseOptions({ discoverInstalledSkills, discoverInstalledSkillsAcrossTargets }),
    ),
  );
  const second = await captureConsole(() =>
    runUpdateCommand(
      ["--all"],
      baseOptions({ discoverInstalledSkills, discoverInstalledSkillsAcrossTargets }),
    ),
  );

  assert.equal(first.result, 0);
  assert.equal(second.result, 0);
  assert.deepEqual(discoverAcrossCalls, ["all", "all"]);
});

test("passes --agent-target root to discovery and install workflow", async () => {
  let discoveredTarget;
  let installedTarget;
  let discoveredAcrossCount = 0;
  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--agent-target", "claude"],
      baseOptions({
        discoverInstalledSkills: async (_cwd, _registryBaseUrl, agentTarget) => {
          discoveredTarget = agentTarget;
          return [makeTarget("@owner/skill-a", "claude")];
        },
        discoverInstalledSkillsAcrossTargets: async () => {
          discoveredAcrossCount += 1;
          return [];
        },
        installFromRegistry: async (input) => {
          installedTarget = input.selectedAgentTarget;
          return {
            result: {
              skillId: "@owner/skill-a",
              ownerLogin: "owner",
              skill: "skill-a",
              version: "1.2.3",
              digest: "sha256:test",
              sizeBytes: 5,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath:
                "/workspace/project/.claude/skills/registry.skillmarkdown.com/owner/skill-a",
              registryBaseUrl: "https://registry.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              source: "registry",
              agentTarget: "claude",
            },
            metadata: {
              skillId: "@owner/skill-a",
            },
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(discoveredTarget, "claude");
  assert.equal(installedTarget, "claude");
  assert.equal(discoveredAcrossCount, 0);
});

test("uses explicit env agent target for all-mode discovery when flag is absent", async () => {
  let discoveredTarget;
  let discoveredAcrossCount = 0;

  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all"],
      baseOptions({
        env: {
          SKILLMD_FIREBASE_PROJECT_ID: "skillmarkdown-development",
          SKILLMD_REGISTRY_BASE_URL: "https://registry.example.com",
          SKILLMD_REGISTRY_TIMEOUT_MS: "10000",
          SKILLMD_AGENT_TARGET: "gemini",
        },
        getConfig: () => ({
          firebaseProjectId: "skillmarkdown-development",
          registryBaseUrl: "https://registry.example.com",
          requestTimeoutMs: 10000,
          defaultAgentTarget: "gemini",
        }),
        discoverInstalledSkills: async (_cwd, _registryBaseUrl, agentTarget) => {
          discoveredTarget = agentTarget;
          return [];
        },
        discoverInstalledSkillsAcrossTargets: async () => {
          discoveredAcrossCount += 1;
          return [];
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(discoveredTarget, "gemini");
  assert.equal(discoveredAcrossCount, 0);
});

test("json output disambiguates duplicate skill installs across agent targets", async () => {
  const duplicateTargets = [
    makeTarget("@owner/skill", "skillmd"),
    makeTarget("@owner/skill", "claude"),
  ];

  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--json"],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => duplicateTargets,
        readInstalledSkillMetadata: async (installedPath) => ({
          version: "1.0.0",
          agentTarget: installedPath.includes("/.claude/") ? "claude" : "skillmd",
          installIntent: {
            strategy: "latest_fallback_beta",
            value: null,
          },
        }),
        installFromRegistry: async (input) => ({
          result: {
            skillId: "@owner/skill",
            ownerLogin: "owner",
            skill: "skill",
            version: input.selectedAgentTarget === "claude" ? "1.1.1" : "1.1.0",
            digest: "sha256:test",
            sizeBytes: 5,
            mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
            installedPath:
              input.selectedAgentTarget === "claude"
                ? "/workspace/project/.claude/skills/registry.skillmarkdown.com/owner/skill"
                : "/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/skill",
            registryBaseUrl: "https://registry.example.com",
            installedAt: "2026-03-02T12:34:56.000Z",
            source: "registry",
            agentTarget: input.selectedAgentTarget,
          },
          metadata: {
            skillId: "@owner/skill",
          },
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.updated.length, 2);

  const byTarget = new Map(parsed.updated.map((entry) => [entry.agentTarget, entry]));
  assert.equal(byTarget.get("skillmd").skillId, "@owner/skill");
  assert.equal(byTarget.get("claude").skillId, "@owner/skill");
  assert.match(byTarget.get("skillmd").installedPath, /\/\.agent\/skills\//);
  assert.match(byTarget.get("claude").installedPath, /\/\.claude\/skills\//);
});

test("updated entry uses result installedPath when effective target differs from discovered path", async () => {
  const discovered = makeTarget("@owner/skill", "skillmd");
  const installPath = "/workspace/project/.claude/skills/registry.skillmarkdown.com/owner/skill";

  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--json"],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => [discovered],
        readInstalledSkillMetadata: async () => ({
          version: "1.0.0",
          agentTarget: "claude",
          installIntent: {
            strategy: "latest_fallback_beta",
            value: null,
          },
        }),
        installFromRegistry: async (input) => {
          assert.equal(input.selectedAgentTarget, "claude");
          return {
            result: {
              skillId: "@owner/skill",
              ownerLogin: "owner",
              skill: "skill",
              version: "1.1.0",
              digest: "sha256:test",
              sizeBytes: 5,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath: installPath,
              registryBaseUrl: "https://registry.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              source: "registry",
              agentTarget: "claude",
            },
            metadata: {
              skillId: "@owner/skill",
            },
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.updated.length, 1);
  assert.equal(parsed.updated[0].agentTarget, "claude");
  assert.equal(parsed.updated[0].installedPath, installPath);
});

test("human output includes target column for duplicate skill installs", async () => {
  const duplicateTargets = [
    makeTarget("@owner/skill", "skillmd"),
    makeTarget("@owner/skill", "claude"),
  ];

  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["--all"],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => duplicateTargets,
        readInstalledSkillMetadata: async (installedPath) => ({
          version: "1.0.0",
          agentTarget: installedPath.includes("/.claude/") ? "claude" : "skillmd",
          installIntent: {
            strategy: "latest_fallback_beta",
            value: null,
          },
        }),
        installFromRegistry: async (input) => ({
          result: {
            skillId: "@owner/skill",
            ownerLogin: "owner",
            skill: "skill",
            version: input.selectedAgentTarget === "claude" ? "1.1.1" : "1.1.0",
            digest: "sha256:test",
            sizeBytes: 5,
            mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
            installedPath:
              input.selectedAgentTarget === "claude"
                ? "/workspace/project/.claude/skills/registry.skillmarkdown.com/owner/skill"
                : "/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/skill",
            registryBaseUrl: "https://registry.example.com",
            installedAt: "2026-03-02T12:34:56.000Z",
            source: "registry",
            agentTarget: input.selectedAgentTarget,
          },
          metadata: {
            skillId: "@owner/skill",
          },
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const output = logs.join("\n");
  assert.match(output, /TARGET/);
  assert.match(output, /skillmd/);
  assert.match(output, /claude/);
});

test("does not resolve read token before updates begin", async () => {
  const { result } = await captureConsole(() =>
    runUpdateCommand(
      [],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => [],
        resolveReadIdToken: async () => {
          throw new Error("should not be called");
        },
      }),
    ),
  );

  assert.equal(result, 0);
});

test("reuses resolved read token across multi-skill update batch", async () => {
  let tokenResolutionCount = 0;

  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all"],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => [
          makeTarget("@owner/skill-a"),
          makeTarget("@owner/skill-b"),
        ],
        resolveReadIdToken: async () => {
          tokenResolutionCount += 1;
          return "id_token_123";
        },
        installFromRegistry: async (input) => {
          await input.resolveReadIdToken?.();
          return {
            result: {
              skillId: `@${input.ownerSlug}/${input.skillSlug}`,
              ownerLogin: input.ownerSlug,
              skill: input.skillSlug,
              version: "1.2.3",
              digest: "sha256:test",
              sizeBytes: 5,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath:
                `/workspace/project/.agent/skills/registry.skillmarkdown.com/` +
                `${input.ownerSlug}/${input.skillSlug}`,
              registryBaseUrl: "https://registry.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              source: "registry",
            },
            metadata: {
              skillId: `@${input.ownerSlug}/${input.skillSlug}`,
            },
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(tokenResolutionCount, 1);
});

test("retries token resolution in later skills when first resolution returns null", async () => {
  let tokenResolutionCount = 0;

  const { result } = await captureConsole(() =>
    runUpdateCommand(
      ["--all"],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => [
          makeTarget("@owner/skill-a"),
          makeTarget("@owner/skill-b"),
        ],
        resolveReadIdToken: async () => {
          tokenResolutionCount += 1;
          return tokenResolutionCount === 1 ? null : "id_token_123";
        },
        installFromRegistry: async (input) => {
          await input.resolveReadIdToken?.();
          return {
            result: {
              skillId: `@${input.ownerSlug}/${input.skillSlug}`,
              ownerLogin: input.ownerSlug,
              skill: input.skillSlug,
              version: "1.2.3",
              digest: "sha256:test",
              sizeBytes: 5,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath:
                `/workspace/project/.agent/skills/registry.skillmarkdown.com/` +
                `${input.ownerSlug}/${input.skillSlug}`,
              registryBaseUrl: "https://registry.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              source: "registry",
            },
            metadata: {
              skillId: `@${input.ownerSlug}/${input.skillSlug}`,
            },
          };
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(tokenResolutionCount, 2);
});

test("updates explicit skill ids and returns json summary", async () => {
  const targets = {
    "@owner/skill-a": makeTarget("@owner/skill-a"),
    "@owner/skill-b": makeTarget("@owner/skill-b"),
  };

  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["@owner/skill-a", "owner/skill-b", "--json"],
      baseOptions({
        access: async () => {},
        readInstalledSkillMetadata: async (installedPath) => {
          if (installedPath.endsWith("owner/skill-a")) {
            return {
              version: "1.0.0",
              installIntent: {
                strategy: "latest_fallback_beta",
                value: null,
              },
            };
          }
          return {
            version: "2.0.0",
            installIntent: {
              strategy: "channel",
              value: "beta",
            },
          };
        },
        installFromRegistry: async (input) => ({
          result: {
            skillId: `@${input.ownerSlug}/${input.skillSlug}`,
            ownerLogin: input.ownerSlug,
            skill: input.skillSlug,
            version: input.skillSlug === "skill-a" ? "1.1.0" : "2.1.0-beta.1",
            digest: "sha256:test",
            sizeBytes: 5,
            mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
            installedPath: targets[`@${input.ownerSlug}/${input.skillSlug}`].installedPath,
            registryBaseUrl: "https://registry.example.com",
            installedAt: "2026-03-02T12:34:56.000Z",
            source: "registry",
          },
          metadata: {
            skillId: `@${input.ownerSlug}/${input.skillSlug}`,
          },
        }),
      }),
    ),
  );

  assert.equal(result, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.mode, "ids");
  assert.equal(parsed.total, 2);
  assert.equal(parsed.updated.length, 2);
  assert.equal(parsed.failed.length, 0);
});

test("skips version-pinned installs", async () => {
  let installCalls = 0;

  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["@owner/skill", "--json"],
      baseOptions({
        readInstalledSkillMetadata: async () => ({
          version: "1.2.3",
          installIntent: {
            strategy: "version",
            value: "1.2.3",
          },
        }),
        installFromRegistry: async () => {
          installCalls += 1;
          throw new Error("should not be called");
        },
      }),
    ),
  );

  assert.equal(result, 0);
  assert.equal(installCalls, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.skipped.length, 1);
  assert.equal(parsed.skipped[0].status, "skipped_pinned");
});

test("continues after failure and exits non-zero", async () => {
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["--all", "--json"],
      baseOptions({
        discoverInstalledSkillsAcrossTargets: async () => [
          makeTarget("@owner/skill-a"),
          makeTarget("@owner/skill-b"),
        ],
        installFromRegistry: async (input) => {
          if (input.skillSlug === "skill-a") {
            throw new UseApiError(404, "invalid_request", "channel not set for skill");
          }

          return {
            result: {
              skillId: "@owner/skill-b",
              ownerLogin: "owner",
              skill: "skill-b",
              version: "2.0.0",
              digest: "sha256:test",
              sizeBytes: 5,
              mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
              installedPath:
                "/workspace/project/.agent/skills/registry.skillmarkdown.com/owner/skill-b",
              registryBaseUrl: "https://registry.example.com",
              installedAt: "2026-03-02T12:34:56.000Z",
              source: "registry",
            },
            metadata: {
              skillId: "@owner/skill-b",
            },
          };
        },
      }),
    ),
  );

  assert.equal(result, 1);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.updated.length, 1);
  assert.equal(parsed.failed.length, 1);
});

test("marks explicit missing install as failed", async () => {
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["@owner/skill", "--json"],
      baseOptions({
        access: async () => {
          const error = new Error("missing");
          error.code = "ENOENT";
          throw error;
        },
      }),
    ),
  );

  assert.equal(result, 1);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.failed.length, 1);
  assert.match(parsed.failed[0].reason, /not installed/i);
});

test("marks explicit access errors distinctly from missing installs", async () => {
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["@owner/skill", "--json"],
      baseOptions({
        access: async () => {
          const error = new Error("permission denied");
          error.code = "EACCES";
          throw error;
        },
      }),
    ),
  );

  assert.equal(result, 1);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.failed.length, 1);
  assert.match(parsed.failed[0].reason, /unable to access installed skill path/i);
});

test("marks invalid install metadata as failed", async () => {
  let installCalls = 0;
  const { result, logs } = await captureConsole(() =>
    runUpdateCommand(
      ["@owner/skill", "--json"],
      baseOptions({
        readInstalledSkillMetadata: async () => {
          throw new Error("install metadata contains invalid JSON");
        },
        installFromRegistry: async () => {
          installCalls += 1;
          throw new Error("should not be called");
        },
      }),
    ),
  );

  assert.equal(result, 1);
  assert.equal(installCalls, 0);
  const parsed = JSON.parse(logs.join("\n"));
  assert.equal(parsed.failed.length, 1);
  assert.match(parsed.failed[0].reason, /invalid install metadata/i);
});
