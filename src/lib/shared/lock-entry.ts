import { type InstalledSkillLockEntry } from "../use/types";
import {
  type SkillsLockEntry,
  type SkillsLockFile,
  upsertSkillsLockEntry,
} from "../workspace/skills-lock";

export function toSkillsLockEntry(
  entry: InstalledSkillLockEntry,
  selectorSpec: string = entry.selectorSpec,
): SkillsLockEntry {
  return {
    skillId: entry.skillId,
    username: entry.username,
    skill: entry.skill,
    agentTarget: entry.agentTarget,
    selectorSpec,
    resolvedVersion: entry.version,
    digest: entry.digest,
    sizeBytes: entry.sizeBytes,
    mediaType: entry.mediaType,
    installedPath: entry.installedPath,
    registryBaseUrl: entry.registryBaseUrl,
    installedAt: entry.installedAt,
    sourceCommand: entry.sourceCommand,
    downloadedFrom: entry.downloadedFrom,
  };
}

export function upsertInstalledLockEntry(
  lock: SkillsLockFile,
  entry: InstalledSkillLockEntry,
  now: Date,
  selectorSpec?: string,
): SkillsLockFile {
  return upsertSkillsLockEntry(lock, toSkillsLockEntry(entry, selectorSpec), now);
}
