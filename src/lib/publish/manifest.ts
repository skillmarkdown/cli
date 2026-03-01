import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

import { type PackedArtifact, type PublishChannel, type PublishManifest } from "./types";

interface BuildPublishManifestOptions {
  targetDir: string;
  skill: string;
  version: string;
  channel: PublishChannel;
  artifact: PackedArtifact;
}

function readSkillDescription(targetDir: string): string | undefined {
  const skillPath = join(targetDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    return undefined;
  }

  const content = readFileSync(skillPath, "utf8");
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

export function buildPublishManifest(options: BuildPublishManifestOptions): PublishManifest {
  const description = readSkillDescription(options.targetDir);

  return {
    schemaVersion: "skillmd.publish.v1",
    skill: options.skill,
    version: options.version,
    channel: options.channel,
    digest: options.artifact.digest,
    sizeBytes: options.artifact.sizeBytes,
    mediaType: options.artifact.mediaType,
    description,
    files: options.artifact.files,
  };
}
