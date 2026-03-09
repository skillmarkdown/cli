import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { parseSkillId } from "../registry/skill-id";
import { normalizeAgentTarget, type AgentTarget } from "../shared/agent-target";

export const SKILLS_MANIFEST_FILENAME = "skills.json";
export const SKILLS_MANIFEST_VERSION = 1;

export interface SkillsManifestDefaults {
  agentTarget?: AgentTarget;
}

export interface SkillsManifestDependency {
  skillId: string;
  username: string;
  skillSlug: string;
  spec: string;
  agentTarget?: AgentTarget;
}

export interface SkillsManifestFile {
  version: 1;
  defaults: SkillsManifestDefaults;
  dependencies: SkillsManifestDependency[];
}

interface SkillsManifestDependencies {
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  rename: typeof fs.rename;
  mkdir: typeof fs.mkdir;
}

const DEFAULT_DEPENDENCIES: SkillsManifestDependencies = {
  readFile: fs.readFile.bind(fs),
  writeFile: fs.writeFile.bind(fs),
  rename: fs.rename.bind(fs),
  mkdir: fs.mkdir.bind(fs),
};

function invalid(message: string): never {
  throw new Error(`invalid skills manifest: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDefaults(value: unknown): SkillsManifestDefaults {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    invalid("defaults must be an object when provided");
  }

  const allowedKeys = new Set(["agentTarget"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      invalid(`unknown defaults field '${key}'`);
    }
  }

  if (value.agentTarget === undefined) {
    return {};
  }
  if (typeof value.agentTarget !== "string") {
    invalid("defaults.agentTarget must be a string");
  }

  const parsedTarget = normalizeAgentTarget(value.agentTarget);
  if (!parsedTarget) {
    invalid("defaults.agentTarget must be a valid agent target");
  }

  return {
    agentTarget: parsedTarget,
  };
}

function parseDependencies(value: unknown): SkillsManifestDependency[] {
  if (!isRecord(value)) {
    invalid("dependencies must be an object");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return [];
  }

  const parsed: SkillsManifestDependency[] = [];
  for (const [rawSkillId, rawDependency] of entries) {
    const canonical = parseSkillId(rawSkillId);
    if (canonical.skillId !== rawSkillId) {
      invalid(`dependency key '${rawSkillId}' must be canonical '@username/skill'`);
    }
    if (!isRecord(rawDependency)) {
      invalid(`dependency '${rawSkillId}' must be an object`);
    }

    const allowedKeys = new Set(["spec", "agentTarget"]);
    for (const key of Object.keys(rawDependency)) {
      if (!allowedKeys.has(key)) {
        invalid(`dependency '${rawSkillId}' has unknown field '${key}'`);
      }
    }

    if (typeof rawDependency.spec !== "string" || rawDependency.spec.trim().length === 0) {
      invalid(`dependency '${rawSkillId}' requires non-empty string field 'spec'`);
    }

    let agentTarget: AgentTarget | undefined;
    if (rawDependency.agentTarget !== undefined) {
      if (typeof rawDependency.agentTarget !== "string") {
        invalid(`dependency '${rawSkillId}'.agentTarget must be a string`);
      }
      const parsedTarget = normalizeAgentTarget(rawDependency.agentTarget);
      if (!parsedTarget) {
        invalid(`dependency '${rawSkillId}'.agentTarget must be a valid agent target`);
      }
      agentTarget = parsedTarget;
    }

    parsed.push({
      skillId: canonical.skillId,
      username: canonical.username,
      skillSlug: canonical.skillSlug,
      spec: rawDependency.spec.trim(),
      agentTarget,
    });
  }

  return parsed.sort((left, right) => left.skillId.localeCompare(right.skillId));
}

function normalizeManifest(value: unknown): SkillsManifestFile {
  if (!isRecord(value)) {
    invalid("manifest root must be an object");
  }

  const allowedKeys = new Set(["version", "defaults", "dependencies"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      invalid(`unknown top-level field '${key}'`);
    }
  }

  if (value.version !== SKILLS_MANIFEST_VERSION) {
    invalid(`version must be ${SKILLS_MANIFEST_VERSION}`);
  }

  return {
    version: SKILLS_MANIFEST_VERSION,
    defaults: parseDefaults(value.defaults),
    dependencies: parseDependencies(value.dependencies),
  };
}

export function resolveSkillsManifestPath(cwd: string): string {
  return join(cwd, SKILLS_MANIFEST_FILENAME);
}

export async function loadSkillsManifest(
  cwd: string,
  dependencies: Partial<SkillsManifestDependencies> = {},
): Promise<SkillsManifestFile> {
  const fileOps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const manifestPath = resolveSkillsManifestPath(cwd);

  let raw: string;
  try {
    raw = await fileOps.readFile(manifestPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const notFoundError = new Error(`skills manifest not found: ${SKILLS_MANIFEST_FILENAME}`);
      (notFoundError as Error & { cause?: unknown }).cause = error;
      throw notFoundError;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    invalid(`${SKILLS_MANIFEST_FILENAME} contains malformed JSON`);
  }

  return normalizeManifest(parsed);
}

export function createEmptySkillsManifest(
  defaults: SkillsManifestDefaults = {},
): SkillsManifestFile {
  return {
    version: SKILLS_MANIFEST_VERSION,
    defaults,
    dependencies: [],
  };
}

export async function loadSkillsManifestOrEmpty(
  cwd: string,
  dependencies: Partial<SkillsManifestDependencies> = {},
): Promise<SkillsManifestFile> {
  try {
    return await loadSkillsManifest(cwd, dependencies);
  } catch (error) {
    if (error instanceof Error && error.message.includes("skills manifest not found")) {
      return createEmptySkillsManifest();
    }
    throw error;
  }
}

export async function saveSkillsManifest(
  cwd: string,
  manifest: SkillsManifestFile,
  dependencies: Partial<SkillsManifestDependencies> = {},
): Promise<void> {
  const fileOps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const manifestPath = resolveSkillsManifestPath(cwd);
  const tempPath = `${manifestPath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;

  // Convert dependencies array to object format for JSON
  const dependenciesObj: Record<string, { spec: string; agentTarget?: string }> = {};
  for (const dep of manifest.dependencies) {
    const entry: { spec: string; agentTarget?: string } = { spec: dep.spec };
    if (dep.agentTarget) {
      entry.agentTarget = dep.agentTarget;
    }
    dependenciesObj[dep.skillId] = entry;
  }

  const jsonPayload = {
    version: manifest.version,
    defaults: manifest.defaults,
    dependencies: dependenciesObj,
  };

  const payload = `${JSON.stringify(jsonPayload, null, 2)}\n`;

  await fileOps.mkdir(cwd, { recursive: true });
  await fileOps.writeFile(tempPath, payload, "utf8");
  await fileOps.rename(tempPath, manifestPath);
}

export function upsertSkillsManifestDependency(
  manifest: SkillsManifestFile,
  dependency: SkillsManifestDependency,
): SkillsManifestFile {
  const existingDeps = manifest.dependencies.filter((dep) => dep.skillId !== dependency.skillId);
  const newDeps = [...existingDeps, dependency].sort((left, right) =>
    left.skillId.localeCompare(right.skillId),
  );

  return {
    ...manifest,
    dependencies: newDeps,
  };
}
