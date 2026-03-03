const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");
const { requireDist } = require("../helpers/dist-imports.js");

const {
  discoverInstalledSkills,
  discoverInstalledSkillsAcrossTargets,
  readInstalledSkillMetadata,
  toInstalledSkillTarget,
} = requireDist("lib/update/discovery.js");

const TEST_PREFIX = "skillmd-update-discovery-";

test("discoverInstalledSkills finds valid directories and sorts deterministically", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const hostRoot = path.join(root, ".agent", "skills", "registry.skillmarkdown.com");
    fs.mkdirSync(path.join(hostRoot, "owner-b", "skill-z"), { recursive: true });
    fs.mkdirSync(path.join(hostRoot, "owner-a", "skill-a"), { recursive: true });
    fs.mkdirSync(path.join(hostRoot, "-badowner", "bad-skill"), { recursive: true });

    const otherHostRoot = path.join(root, ".agent", "skills", "other.host.example");
    fs.mkdirSync(path.join(otherHostRoot, "owner-x", "skill-x"), { recursive: true });

    const discovered = await discoverInstalledSkills(root, "https://registry.example.com");

    assert.deepEqual(
      discovered.map((entry) => entry.skillId),
      ["@owner-a/skill-a", "@owner-b/skill-z"],
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("discoverInstalledSkills scans provider-specific host roots", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const hostRoot = path.join(root, ".claude", "skills", "registry.skillmarkdown.com");
    fs.mkdirSync(path.join(hostRoot, "owner-a", "skill-a"), { recursive: true });

    const discovered = await discoverInstalledSkills(
      root,
      "https://registry.example.com",
      "claude",
    );
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0].agentTarget, "claude");
    assert.ok(discovered[0].installedPath.includes("/.claude/skills/registry.skillmarkdown.com/"));
  } finally {
    cleanupDirectory(root);
  }
});

test("discoverInstalledSkillsAcrossTargets aggregates builtin and custom target roots", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    fs.mkdirSync(
      path.join(root, ".agent", "skills", "registry.skillmarkdown.com", "owner-a", "skill-a"),
      {
        recursive: true,
      },
    );
    fs.mkdirSync(
      path.join(root, ".claude", "skills", "registry.skillmarkdown.com", "owner-b", "skill-b"),
      {
        recursive: true,
      },
    );
    fs.mkdirSync(
      path.join(
        root,
        ".agents",
        "skills",
        "myagent",
        "registry.skillmarkdown.com",
        "owner-c",
        "skill-c",
      ),
      { recursive: true },
    );
    fs.mkdirSync(
      path.join(
        root,
        ".agents",
        "skills",
        "INVALID",
        "registry.skillmarkdown.com",
        "owner-d",
        "skill-d",
      ),
      { recursive: true },
    );

    const discovered = await discoverInstalledSkillsAcrossTargets(
      root,
      "https://registry.example.com",
    );

    assert.deepEqual(
      discovered.map((entry) => `${entry.skillId}:${entry.agentTarget}`),
      ["@owner-a/skill-a:skillmd", "@owner-b/skill-b:claude", "@owner-c/skill-c:custom:myagent"],
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("discoverInstalledSkills returns empty list when root is missing", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const discovered = await discoverInstalledSkills(root, "https://registry.example.com");
    assert.deepEqual(discovered, []);
  } finally {
    cleanupDirectory(root);
  }
});

test("readInstalledSkillMetadata returns parsed metadata when file exists", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const installedPath = path.join(
      root,
      ".agent",
      "skills",
      "registry.skillmarkdown.com",
      "owner",
      "skill",
    );
    fs.mkdirSync(installedPath, { recursive: true });
    fs.writeFileSync(
      path.join(installedPath, ".skillmd-install.json"),
      JSON.stringify(
        {
          skillId: "@owner/skill",
          version: "1.2.3",
          sourceCommand: "skillmd use @owner/skill",
          installIntent: {
            strategy: "latest_fallback_beta",
            value: null,
          },
          agentTarget: "custom:myagent",
        },
        null,
        2,
      ),
      "utf8",
    );

    const metadata = await readInstalledSkillMetadata(installedPath);
    assert.equal(metadata.skillId, "@owner/skill");
    assert.equal(metadata.version, "1.2.3");
    assert.equal(metadata.installIntent.strategy, "latest_fallback_beta");
    assert.equal(metadata.agentTarget, "custom:myagent");
  } finally {
    cleanupDirectory(root);
  }
});

test("readInstalledSkillMetadata throws on invalid JSON metadata", async () => {
  const root = makeTempDirectory(TEST_PREFIX);

  try {
    const installedPath = path.join(
      root,
      ".agent",
      "skills",
      "registry.skillmarkdown.com",
      "owner",
      "skill",
    );
    fs.mkdirSync(installedPath, { recursive: true });
    fs.writeFileSync(path.join(installedPath, ".skillmd-install.json"), "{not-json", "utf8");

    await assert.rejects(
      readInstalledSkillMetadata(installedPath),
      /install metadata contains invalid JSON/i,
    );
  } finally {
    cleanupDirectory(root);
  }
});

test("toInstalledSkillTarget normalizes owner and skill slugs", () => {
  const target = toInstalledSkillTarget(
    "/workspace/project",
    "https://registry.example.com",
    "@Owner-Name/Skill-Name",
  );

  assert.equal(target.skillId, "@owner-name/skill-name");
  assert.ok(
    target.installedPath.endsWith(
      "/.agent/skills/registry.skillmarkdown.com/owner-name/skill-name",
    ),
  );
  assert.equal(target.agentTarget, "skillmd");
});
