import { promises as fs } from "node:fs";
import { join } from "node:path";

import { parseSkillId } from "../registry/skill-id";
import { normalizeAgentTarget, type AgentTarget } from "../shared/agent-target";

export const SKILLS_MANIFEST_FILENAME = "skills.json";
export const SKILLS_MANIFEST_VERSION = 1;

export interface SkillsManifestDefaults {
  agentTarget?: AgentTarget;
}

export interface SkillsManifestDependency {
  skillId: string;
  ownerSlug: string;
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
}

const DEFAULT_DEPENDENCIES: SkillsManifestDependencies = {
  readFile: fs.readFile.bind(fs),
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
    invalid("dependencies must contain at least one entry");
  }

  const parsed: SkillsManifestDependency[] = [];
  for (const [rawSkillId, rawDependency] of entries) {
    const canonical = parseSkillId(rawSkillId);
    if (canonical.skillId !== rawSkillId) {
      invalid(`dependency key '${rawSkillId}' must be canonical '@owner/skill'`);
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
      ownerSlug: canonical.ownerSlug,
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
