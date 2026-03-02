import { promises as fs } from "node:fs";
import { join } from "node:path";
import { type Dirent } from "node:fs";

import { parseSkillId } from "../registry/skill-id";
import { resolveInstalledSkillPath, resolveInstalledSkillsHostRoot } from "../use/pathing";
import { type InstallIntent } from "../use/types";
import { type InstalledSkillTarget, type UpdateInstalledMetadata } from "./types";

interface DiscoveryDependencies {
  readdir: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]>;
  readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
}

const DEFAULT_DEPENDENCIES: DiscoveryDependencies = {
  readdir: async (path, options) => fs.readdir(path, options),
  readFile: async (path, encoding) => fs.readFile(path, encoding),
};

function toInstallIntent(value: unknown): InstallIntent | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (
    record.strategy === "version" &&
    typeof record.value === "string" &&
    record.value.trim().length > 0
  ) {
    return {
      strategy: "version",
      value: record.value,
    };
  }

  if (record.strategy === "channel" && (record.value === "latest" || record.value === "beta")) {
    return {
      strategy: "channel",
      value: record.value,
    };
  }

  if (record.strategy === "latest_fallback_beta") {
    return {
      strategy: "latest_fallback_beta",
      value: null,
    };
  }

  return undefined;
}

function normalizeMetadata(value: unknown): UpdateInstalledMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    skillId: typeof record.skillId === "string" ? record.skillId : undefined,
    ownerLogin: typeof record.ownerLogin === "string" ? record.ownerLogin : undefined,
    skill: typeof record.skill === "string" ? record.skill : undefined,
    version: typeof record.version === "string" ? record.version : undefined,
    digest: typeof record.digest === "string" ? record.digest : undefined,
    sizeBytes: typeof record.sizeBytes === "number" ? record.sizeBytes : undefined,
    mediaType: typeof record.mediaType === "string" ? record.mediaType : undefined,
    registryBaseUrl:
      typeof record.registryBaseUrl === "string" ? record.registryBaseUrl : undefined,
    downloadedFrom: typeof record.downloadedFrom === "string" ? record.downloadedFrom : undefined,
    installedAt: typeof record.installedAt === "string" ? record.installedAt : undefined,
    sourceCommand: typeof record.sourceCommand === "string" ? record.sourceCommand : undefined,
    installIntent: toInstallIntent(record.installIntent),
  };
}

export async function discoverInstalledSkills(
  cwd: string,
  registryBaseUrl: string,
  dependencies: Partial<DiscoveryDependencies> = {},
): Promise<InstalledSkillTarget[]> {
  const readdir = dependencies.readdir ?? DEFAULT_DEPENDENCIES.readdir;
  const hostRoot = resolveInstalledSkillsHostRoot(cwd, registryBaseUrl);

  let ownerEntries: Dirent[];
  try {
    ownerEntries = await readdir(hostRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const targets: InstalledSkillTarget[] = [];

  for (const ownerEntry of ownerEntries) {
    if (!ownerEntry.isDirectory()) {
      continue;
    }

    const ownerSlug = ownerEntry.name;
    const ownerPath = join(hostRoot, ownerSlug);
    let skillEntries: Dirent[];
    try {
      skillEntries = await readdir(ownerPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory()) {
        continue;
      }

      const skillSlug = skillEntry.name;
      try {
        const parsed = parseSkillId(`@${ownerSlug}/${skillSlug}`);
        targets.push({
          skillId: parsed.skillId,
          ownerSlug: parsed.ownerSlug,
          skillSlug: parsed.skillSlug,
          installedPath: resolveInstalledSkillPath(
            cwd,
            registryBaseUrl,
            parsed.ownerSlug,
            parsed.skillSlug,
          ),
        });
      } catch {
        // Ignore unexpected directory names that are not valid skill identifiers.
      }
    }
  }

  targets.sort((a, b) => a.skillId.localeCompare(b.skillId));
  return targets;
}

export function toInstalledSkillTarget(
  cwd: string,
  registryBaseUrl: string,
  rawSkillId: string,
): InstalledSkillTarget {
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
    ),
  };
}

export async function readInstalledSkillMetadata(
  installedPath: string,
  dependencies: Partial<DiscoveryDependencies> = {},
): Promise<UpdateInstalledMetadata | null> {
  const readFile = dependencies.readFile ?? DEFAULT_DEPENDENCIES.readFile;

  try {
    const raw = await readFile(join(installedPath, ".skillmd-install.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeMetadata(parsed);
    if (!normalized) {
      throw new Error("install metadata must be a JSON object");
    }
    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      const wrapped = new Error("install metadata contains invalid JSON") as Error & {
        cause?: unknown;
      };
      wrapped.cause = error;
      throw wrapped;
    }

    throw error;
  }
}
