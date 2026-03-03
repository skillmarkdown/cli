import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

import * as tar from "tar";

interface InstallSkillArtifactInput {
  targetPath: string;
  tempRoot: string;
  archiveBytes: Buffer;
}

interface InstallFileOps {
  access: typeof fs.access;
  stat: typeof fs.stat;
  lstat: typeof fs.lstat;
  mkdir: typeof fs.mkdir;
  writeFile: typeof fs.writeFile;
  rm: typeof fs.rm;
  rename: typeof fs.rename;
}

interface InstallSkillArtifactDependencies {
  fileOps?: InstallFileOps;
  tarExtract?: typeof tar.x;
  tarList?: typeof tar.t;
}

const DEFAULT_FILE_OPS: InstallFileOps = {
  access: fs.access.bind(fs),
  stat: fs.stat.bind(fs),
  lstat: fs.lstat.bind(fs),
  mkdir: fs.mkdir.bind(fs),
  writeFile: fs.writeFile.bind(fs),
  rm: fs.rm.bind(fs),
  rename: fs.rename.bind(fs),
};

function isDisallowedArchiveEntryType(type: string | undefined): boolean {
  return type === "SymbolicLink" || type === "Link";
}

async function assertArchiveContainsNoLinkEntries(
  archivePath: string,
  tarList: typeof tar.t,
): Promise<void> {
  let disallowed:
    | {
        type: string;
        path: string;
      }
    | undefined;

  await tarList({
    file: archivePath,
    onentry(entry) {
      if (!disallowed && isDisallowedArchiveEntryType(entry.type)) {
        disallowed = {
          type: entry.type,
          path: entry.path,
        };
      }
    },
  });

  if (disallowed) {
    throw new Error(
      `invalid artifact: archive contains unsupported ${disallowed.type.toLowerCase()} entry '${disallowed.path}'`,
    );
  }
}

async function exists(path: string, fileOps: InstallFileOps): Promise<boolean> {
  try {
    await fileOps.access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertExtractedSkillShape(path: string, fileOps: InstallFileOps): Promise<void> {
  const skillFilePath = join(path, "SKILL.md");
  let stats;
  try {
    stats = await fileOps.lstat(skillFilePath);
  } catch {
    throw new Error("invalid artifact: SKILL.md not found at archive root");
  }

  if (stats.isSymbolicLink()) {
    throw new Error("invalid artifact: SKILL.md must be a regular file");
  }

  if (!stats.isFile()) {
    throw new Error("invalid artifact: SKILL.md is not a file");
  }
}

export async function installSkillArtifact(
  input: InstallSkillArtifactInput,
  dependencies: InstallSkillArtifactDependencies = {},
): Promise<void> {
  const fileOps = dependencies.fileOps ?? DEFAULT_FILE_OPS;
  const tarExtract = dependencies.tarExtract ?? tar.x;
  const tarList = dependencies.tarList ?? tar.t;
  const runId = `skillmd-use-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDir = join(input.tempRoot, runId);
  const archivePath = join(runDir, "artifact.tgz");
  const extractedPath = join(runDir, "extracted");
  const backupPath = join(input.tempRoot, `${runId}-backup`);

  let movedToBackup = false;
  let installed = false;

  await fileOps.mkdir(runDir, { recursive: true });

  try {
    await fileOps.writeFile(archivePath, input.archiveBytes);
    await assertArchiveContainsNoLinkEntries(archivePath, tarList);
    await fileOps.mkdir(extractedPath, { recursive: true });

    await tarExtract({
      file: archivePath,
      cwd: extractedPath,
      strict: true,
      preservePaths: false,
      preserveOwner: false,
    });

    await assertExtractedSkillShape(extractedPath, fileOps);

    await fileOps.mkdir(dirname(input.targetPath), { recursive: true });

    if (await exists(input.targetPath, fileOps)) {
      await fileOps.rm(backupPath, { recursive: true, force: true });
      await fileOps.rename(input.targetPath, backupPath);
      movedToBackup = true;
    }

    await fileOps.rename(extractedPath, input.targetPath);
    installed = true;

    if (movedToBackup) {
      await fileOps.rm(backupPath, { recursive: true, force: true });
      movedToBackup = false;
    }
  } catch (error) {
    if (movedToBackup && !installed) {
      try {
        if (await exists(input.targetPath, fileOps)) {
          await fileOps.rm(input.targetPath, { recursive: true, force: true });
        }
        await fileOps.rename(backupPath, input.targetPath);
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
    await fileOps.rm(runDir, { recursive: true, force: true });
    if (movedToBackup) {
      await fileOps.rm(backupPath, { recursive: true, force: true });
    }
  }
}
