const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { resolveUpdateIntent } = requireDist("lib/update/intent.js");

test("resolveUpdateIntent returns version selector for exact semver", () => {
  const resolved = resolveUpdateIntent({
    skillId: "skill",
    username: "username",
    skill: "skill",
    selectorSpec: "1.2.3",
    resolvedVersion: "1.2.3",
    digest: "sha256:test",
    sizeBytes: 5,
    mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
    installedPath: "/tmp/skill",
    registryBaseUrl: "https://registry.example.com",
    installedAt: "2026-03-02T00:00:00.000Z",
    sourceCommand: "skillmd use skill --version 1.2.3",
    downloadedFrom: "https://storage.example.com",
    agentTarget: "skillmd",
  });

  assert.deepEqual(resolved, {
    selector: {
      strategy: "version",
      value: "1.2.3",
    },
  });
});

test("resolveUpdateIntent returns spec selector for tags/ranges", () => {
  assert.deepEqual(
    resolveUpdateIntent({
      skillId: "skill",
      username: "username",
      skill: "skill",
      selectorSpec: "^1.2.0",
      resolvedVersion: "1.2.3",
      digest: "sha256:test",
      sizeBytes: 5,
      mediaType: "application/vnd.skillmarkdown.skill.v1+tar",
      installedPath: "/tmp/skill",
      registryBaseUrl: "https://registry.example.com",
      installedAt: "2026-03-02T00:00:00.000Z",
      sourceCommand: "skillmd use skill --spec ^1.2.0",
      downloadedFrom: "https://storage.example.com",
      agentTarget: "skillmd",
    }),
    {
      selector: {
        strategy: "spec",
        value: "^1.2.0",
      },
    },
  );
});

test("resolveUpdateIntent defaults to latest when metadata is missing", () => {
  const resolved = resolveUpdateIntent(null);

  assert.deepEqual(resolved, {
    selector: {
      strategy: "spec",
      value: "latest",
    },
  });
});
