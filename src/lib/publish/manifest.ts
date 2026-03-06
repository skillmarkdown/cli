import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

import { type PackedArtifact, type PublishAccess, type PublishManifest } from "./types";

interface BuildPublishManifestOptions {
  targetDir: string;
  skill: string;
  version: string;
  tag: string;
  access: PublishAccess;
  provenance: boolean;
  artifact: PackedArtifact;
}

function stripUtf8Bom(content: string): string {
  return content.replace(/^\uFEFF/, "");
}

function readSkillDescription(targetDir: string): string | undefined {
  const skillPath = join(targetDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    return undefined;
  }

  const content = stripUtf8Bom(readFileSync(skillPath, "utf8"));
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match || typeof match[1] !== "string") {
    return undefined;
  }

  try {
    const frontmatter = parse(match[1]) as Record<string, unknown>;
    const description = frontmatter.description;
    if (typeof description !== "string" || description.trim().length === 0) {
      return undefined;
    }

    return description;
  } catch {
    return undefined;
  }
}

function readPackageManifest(targetDir: string): Record<string, unknown> | null {
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toNormalizedUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function readHomepage(targetDir: string): string | undefined {
  const manifest = readPackageManifest(targetDir);
  if (!manifest) {
    return undefined;
  }

  const homepage = typeof manifest.homepage === "string" ? manifest.homepage.trim() : "";
  if (!homepage) {
    return undefined;
  }
  return toNormalizedUrl(homepage);
}

function readRepository(targetDir: string): string | undefined {
  const manifest = readPackageManifest(targetDir);
  if (!manifest) {
    return undefined;
  }

  const repository = manifest.repository;
  if (typeof repository === "string") {
    return toNormalizedUrl(repository);
  }

  if (repository && typeof repository === "object" && !Array.isArray(repository)) {
    const url = (repository as Record<string, unknown>).url;
    if (typeof url === "string") {
      return toNormalizedUrl(url);
    }
  }

  return undefined;
}

export function buildPublishManifest(options: BuildPublishManifestOptions): PublishManifest {
  const description = readSkillDescription(options.targetDir);
  const repository = readRepository(options.targetDir);
  const homepage = readHomepage(options.targetDir);

  return {
    schemaVersion: "skillmd.publish.v1",
    skill: options.skill,
    version: options.version,
    tag: options.tag,
    access: options.access,
    provenance: options.provenance,
    digest: options.artifact.digest,
    sizeBytes: options.artifact.sizeBytes,
    mediaType: options.artifact.mediaType,
    description,
    repository,
    homepage,
    files: options.artifact.files,
  };
}
