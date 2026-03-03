import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parseSkillId } from "../registry/skill-id";
import { type AgentTarget } from "../shared/agent-target";
import { type InstalledSkillTarget, type SkillsLockEntry } from "./types";
import {
  SKILLS_LOCK_FILENAME,
  listSkillsLockEntries,
  loadSkillsLock,
  resolveRegistryHost,
} from "../workspace/skills-lock";
import { resolveInstalledSkillPath } from "../use/pathing";

function toInstalledTarget(entry: SkillsLockEntry): InstalledSkillTarget {
  const parsed = parseSkillId(entry.skillId);
  return {
    skillId: parsed.skillId,
    ownerSlug: parsed.ownerSlug,
    skillSlug: parsed.skillSlug,
    installedPath: entry.installedPath,
    agentTarget: entry.agentTarget,
  };
}

function matchesRegistry(entry: SkillsLockEntry, registryBaseUrl: string): boolean {
  try {
    return resolveRegistryHost(entry.registryBaseUrl) === resolveRegistryHost(registryBaseUrl);
  } catch {
    return false;
  }
}

export async function discoverInstalledSkills(
  cwd: string,
  registryBaseUrl: string,
  agentTarget?: AgentTarget,
): Promise<InstalledSkillTarget[]> {
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

export async function discoverInstalledSkillsAcrossTargets(
  cwd: string,
  registryBaseUrl: string,
): Promise<InstalledSkillTarget[]> {
  return discoverInstalledSkills(cwd, registryBaseUrl);
}

export async function readInstalledSkillMetadata(
  installedPath: string,
): Promise<SkillsLockEntry | null> {
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

export function toInstalledSkillTarget(
  _cwd: string,
  _registryBaseUrl: string,
  rawSkillId: string,
  agentTarget: AgentTarget,
): InstalledSkillTarget {
  const parsed = parseSkillId(rawSkillId);
  return {
    skillId: parsed.skillId,
    ownerSlug: parsed.ownerSlug,
    skillSlug: parsed.skillSlug,
    installedPath: resolveInstalledSkillPath(
      _cwd,
      _registryBaseUrl,
      parsed.ownerSlug,
      parsed.skillSlug,
      agentTarget,
    ),
    agentTarget,
  };
}

async function findWorkspaceRootForInstalledPath(installedPath: string): Promise<string | null> {
  let current = resolve(installedPath);

  while (true) {
    try {
      await fs.access(join(current, SKILLS_LOCK_FILENAME));
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
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
