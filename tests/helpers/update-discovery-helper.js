const fs = require("node:fs/promises");
const { dirname, join, resolve } = require("node:path");

const { requireDist } = require("./dist-imports.js");

const { parseSkillId } = requireDist("lib/registry/skill-id.js");
const { resolveInstalledSkillPath } = requireDist("lib/use/pathing.js");
const { SKILLS_LOCK_FILENAME, listSkillsLockEntries, loadSkillsLock, resolveRegistryHost } =
  requireDist("lib/workspace/skills-lock.js");

function toInstalledTarget(entry) {
  const parsed = parseSkillId(entry.skillId);
  return {
    skillId: parsed.skillId,
    ownerSlug: parsed.ownerSlug,
    skillSlug: parsed.skillSlug,
    installedPath: entry.installedPath,
    agentTarget: entry.agentTarget,
  };
}

function matchesRegistry(entry, registryBaseUrl) {
  try {
    return resolveRegistryHost(entry.registryBaseUrl) === resolveRegistryHost(registryBaseUrl);
  } catch {
    return false;
  }
}

async function discoverInstalledSkills(cwd, registryBaseUrl, agentTarget) {
  const lock = await loadSkillsLock(cwd);
  return Object.values(lock.entries)
    .filter((entry) => matchesRegistry(entry, registryBaseUrl))
    .filter((entry) => (agentTarget ? entry.agentTarget === agentTarget : true))
    .map((entry) => toInstalledTarget(entry))
    .sort(
      (a, b) =>
        a.skillId.localeCompare(b.skillId) || a.installedPath.localeCompare(b.installedPath),
    );
}

function discoverInstalledSkillsAcrossTargets(cwd, registryBaseUrl) {
  return discoverInstalledSkills(cwd, registryBaseUrl);
}

async function findWorkspaceRootForInstalledPath(installedPath) {
  let current = resolve(installedPath);
  while (true) {
    try {
      await fs.access(join(current, SKILLS_LOCK_FILENAME));
      return current;
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        throw error;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function readInstalledSkillMetadata(installedPath) {
  const workspaceRoot = await findWorkspaceRootForInstalledPath(installedPath);
  if (!workspaceRoot) {
    return null;
  }

  const lock = await loadSkillsLock(workspaceRoot);
  const normalizedInstalledPath = resolve(installedPath);
  const matches = listSkillsLockEntries(lock)
    .map(({ entry }) => entry)
    .filter((entry) => resolve(entry.installedPath) === normalizedInstalledPath)
    .sort((left, right) => right.installedAt.localeCompare(left.installedAt));
  return matches[0] ?? null;
}

function toInstalledSkillTarget(cwd, registryBaseUrl, rawSkillId, agentTarget) {
  const parsed = parseSkillId(rawSkillId);
  return {
    skillId: parsed.skillId,
    ownerSlug: parsed.ownerSlug,
    skillSlug: parsed.skillSlug,
    installedPath: resolveInstalledSkillPath(
      cwd,
      registryBaseUrl,
      parsed.ownerSlug,
      parsed.skillSlug,
      agentTarget,
    ),
    agentTarget,
  };
}

module.exports = {
  discoverInstalledSkills,
  discoverInstalledSkillsAcrossTargets,
  readInstalledSkillMetadata,
  toInstalledSkillTarget,
};
