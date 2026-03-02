import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

import * as tar from "tar";

import { type InstalledSkillMetadata } from "./types";

interface InstallSkillArtifactInput {
  targetPath: string;
  tempRoot: string;
  archiveBytes: Buffer;
  metadata: InstalledSkillMetadata;
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertExtractedSkillShape(path: string): Promise<void> {
  const skillFilePath = join(path, "SKILL.md");
  let stats;
  try {
    stats = await fs.stat(skillFilePath);
  } catch {
    throw new Error("invalid artifact: SKILL.md not found at archive root");
  }

  if (!stats.isFile()) {
    throw new Error("invalid artifact: SKILL.md is not a file");
  }
}

export async function installSkillArtifact(input: InstallSkillArtifactInput): Promise<void> {
  const runId = `skillmd-use-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDir = join(input.tempRoot, runId);
  const archivePath = join(runDir, "artifact.tgz");
  const extractedPath = join(runDir, "extracted");
  const backupPath = join(input.tempRoot, `${runId}-backup`);

  let movedToBackup = false;
  let installed = false;

  await fs.mkdir(runDir, { recursive: true });

  try {
    await fs.writeFile(archivePath, input.archiveBytes);
    await fs.mkdir(extractedPath, { recursive: true });

    await tar.x({
      file: archivePath,
      cwd: extractedPath,
      strict: true,
      preservePaths: false,
      preserveOwner: false,
    });

    await assertExtractedSkillShape(extractedPath);
    await fs.writeFile(
      join(extractedPath, ".skillmd-install.json"),
      `${JSON.stringify(input.metadata, null, 2)}\n`,
      "utf8",
    );

    await fs.mkdir(dirname(input.targetPath), { recursive: true });

    if (await exists(input.targetPath)) {
      await fs.rm(backupPath, { recursive: true, force: true });
      await fs.rename(input.targetPath, backupPath);
      movedToBackup = true;
    }

    await fs.rename(extractedPath, input.targetPath);
    installed = true;

    if (movedToBackup) {
      await fs.rm(backupPath, { recursive: true, force: true });
      movedToBackup = false;
    }
  } catch (error) {
    if (movedToBackup && !installed) {
      try {
        if (await exists(input.targetPath)) {
          await fs.rm(input.targetPath, { recursive: true, force: true });
        }
        await fs.rename(backupPath, input.targetPath);
        movedToBackup = false;
      } catch (restoreError) {
        const originalMessage = error instanceof Error ? error.message : "unknown";
        const restoreMessage = restoreError instanceof Error ? restoreError.message : "unknown";
        const wrapped = new Error(
          `install failed and restore failed: ${originalMessage}; restore error: ${restoreMessage}`,
        ) as Error & { cause?: unknown };
        wrapped.cause = restoreError;
        throw wrapped;
      }
    }

    throw error;
  } finally {
    await fs.rm(runDir, { recursive: true, force: true });
    if (movedToBackup) {
      await fs.rm(backupPath, { recursive: true, force: true });
    }
  }
}
