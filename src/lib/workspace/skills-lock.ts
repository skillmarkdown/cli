import { promises as fs } from "node:fs";
import { join } from "node:path";

import { normalizeAgentTarget, type AgentTarget } from "../shared/agent-target";

export const SKILLS_LOCK_FILENAME = "skills-lock.json";
export const SKILLS_LOCK_VERSION = 1;

export interface SkillsLockEntry {
  skillId: string;
  ownerLogin: string;
  skill: string;
  agentTarget: AgentTarget;
  selectorSpec: string;
  resolvedVersion: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  installedPath: string;
  registryBaseUrl: string;
  installedAt: string;
  sourceCommand: string;
  downloadedFrom: string;
}

export interface SkillsLockFile {
  lockfileVersion: 1;
  generatedAt: string;
  entries: Record<string, SkillsLockEntry>;
}

interface SkillsLockDependencies {
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  rename: typeof fs.rename;
  mkdir: typeof fs.mkdir;
}

const DEFAULT_DEPENDENCIES: SkillsLockDependencies = {
  readFile: fs.readFile.bind(fs),
  writeFile: fs.writeFile.bind(fs),
  rename: fs.rename.bind(fs),
  mkdir: fs.mkdir.bind(fs),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeEntry(value: unknown): SkillsLockEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const skillId = asTrimmedNonEmptyString(value.skillId);
  const ownerLogin = asTrimmedNonEmptyString(value.ownerLogin);
  const skill = asTrimmedNonEmptyString(value.skill);
  const parsedAgentTarget =
    typeof value.agentTarget === "string" ? normalizeAgentTarget(value.agentTarget) : null;
  const selectorSpec = asTrimmedNonEmptyString(value.selectorSpec);
  const resolvedVersion = asTrimmedNonEmptyString(value.resolvedVersion);
  const digest = asTrimmedNonEmptyString(value.digest);
  const sizeBytes = asFiniteNumber(value.sizeBytes);
  const mediaType = asTrimmedNonEmptyString(value.mediaType);
  const installedPath = asTrimmedNonEmptyString(value.installedPath);
  const registryBaseUrl = asTrimmedNonEmptyString(value.registryBaseUrl);
  const installedAt = asTrimmedNonEmptyString(value.installedAt);
  const sourceCommand = asTrimmedNonEmptyString(value.sourceCommand);
  const downloadedFrom = asTrimmedNonEmptyString(value.downloadedFrom);

  if (
    !skillId ||
    !ownerLogin ||
    !skill ||
    !parsedAgentTarget ||
    !selectorSpec ||
    !resolvedVersion ||
    !digest ||
    sizeBytes === null ||
    !mediaType ||
    !installedPath ||
    !registryBaseUrl ||
    !installedAt ||
    !sourceCommand ||
    !downloadedFrom
  ) {
    return null;
  }

  return {
    skillId,
    ownerLogin,
    skill,
    agentTarget: parsedAgentTarget,
    selectorSpec,
    resolvedVersion,
    digest,
    sizeBytes,
    mediaType,
    installedPath,
    registryBaseUrl,
    installedAt,
    sourceCommand,
    downloadedFrom,
  };
}

function normalizeLock(value: unknown): SkillsLockFile | null {
  if (
    !isRecord(value) ||
    value.lockfileVersion !== SKILLS_LOCK_VERSION ||
    !isRecord(value.entries)
  ) {
    return null;
  }

  const generatedAt = asTrimmedNonEmptyString(value.generatedAt);
  if (!generatedAt) {
    return null;
  }

  const entries: Record<string, SkillsLockEntry> = {};
  for (const [key, candidate] of Object.entries(value.entries)) {
    if (!asTrimmedNonEmptyString(key)) {
      return null;
    }
    const normalizedEntry = normalizeEntry(candidate);
    if (!normalizedEntry) {
      return null;
    }
    entries[key] = normalizedEntry;
  }

  return {
    lockfileVersion: SKILLS_LOCK_VERSION,
    generatedAt,
    entries,
  };
}

function resolveLockPath(cwd: string): string {
  return join(cwd, SKILLS_LOCK_FILENAME);
}

export function createEmptySkillsLock(now: Date = new Date()): SkillsLockFile {
  return {
    lockfileVersion: SKILLS_LOCK_VERSION,
    generatedAt: now.toISOString(),
    entries: {},
  };
}

export function resolveRegistryHost(registryBaseUrl: string): string {
  const url = new URL(registryBaseUrl);
  return url.host.toLowerCase();
}

export function buildSkillsLockKey(entry: SkillsLockEntry): string {
  return `${entry.skillId}|${entry.agentTarget}|${resolveRegistryHost(entry.registryBaseUrl)}|${entry.installedPath}`;
}

export function listSkillsLockEntries(
  lock: SkillsLockFile,
): Array<{ key: string; entry: SkillsLockEntry }> {
  return Object.entries(lock.entries).map(([key, entry]) => ({ key, entry }));
}

export async function loadSkillsLock(
  cwd: string,
  dependencies: Partial<SkillsLockDependencies> = {},
): Promise<SkillsLockFile> {
  const fileOps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const path = resolveLockPath(cwd);
  let raw: string;
  try {
    raw = await fileOps.readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptySkillsLock();
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`invalid skills lockfile: ${SKILLS_LOCK_FILENAME} contains malformed JSON`);
  }

  const normalized = normalizeLock(parsed);
  if (!normalized) {
    throw new Error(
      `invalid skills lockfile: ${SKILLS_LOCK_FILENAME} must match lockfileVersion ${SKILLS_LOCK_VERSION} schema`,
    );
  }
  return normalized;
}

export async function saveSkillsLock(
  cwd: string,
  lock: SkillsLockFile,
  dependencies: Partial<SkillsLockDependencies> = {},
): Promise<void> {
  const normalized = normalizeLock(lock);
  if (!normalized) {
    throw new Error("cannot write invalid skills lockfile payload");
  }
  const fileOps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const path = resolveLockPath(cwd);
  const tempPath = `${path}.tmp`;
  const payload = `${JSON.stringify(normalized, null, 2)}\n`;

  await fileOps.mkdir(cwd, { recursive: true });
  await fileOps.writeFile(tempPath, payload, "utf8");
  await fileOps.rename(tempPath, path);
}

export function upsertSkillsLockEntry(
  lock: SkillsLockFile,
  entry: SkillsLockEntry,
  now: Date = new Date(),
): SkillsLockFile {
  const normalizedEntry = normalizeEntry(entry);
  if (!normalizedEntry) {
    throw new Error("cannot upsert invalid lock entry");
  }
  const key = buildSkillsLockKey(normalizedEntry);
  const normalizedHost = resolveRegistryHost(normalizedEntry.registryBaseUrl);
  const nextEntries = { ...lock.entries };
  for (const [existingKey, existingEntry] of Object.entries(nextEntries)) {
    try {
      const existingHost = resolveRegistryHost(existingEntry.registryBaseUrl);
      if (
        existingEntry.skillId === normalizedEntry.skillId &&
        existingEntry.agentTarget === normalizedEntry.agentTarget &&
        existingHost === normalizedHost
      ) {
        delete nextEntries[existingKey];
      }
    } catch {
      // Ignore malformed entries; strict validation rejects them on load.
    }
  }

  return {
    lockfileVersion: SKILLS_LOCK_VERSION,
    generatedAt: now.toISOString(),
    entries: {
      ...nextEntries,
      [key]: normalizedEntry,
    },
  };
}

export function removeSkillsLockEntry(
  lock: SkillsLockFile,
  key: string,
  now: Date = new Date(),
): SkillsLockFile {
  const nextEntries = { ...lock.entries };
  delete nextEntries[key];
  return {
    lockfileVersion: SKILLS_LOCK_VERSION,
    generatedAt: now.toISOString(),
    entries: nextEntries,
  };
}
