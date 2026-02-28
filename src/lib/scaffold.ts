import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { normalizeSkillName } from "./normalize-name";
import { buildGitignore, buildSkillMarkdown } from "./templates";

export interface ScaffoldResult {
  skillName: string;
}

function assertDirectoryEmpty(targetDir: string): void {
  const entries = readdirSync(targetDir);
  if (entries.length > 0) {
    throw new Error(
      `target directory is not empty (${entries.length} item(s) found); run 'skillmd init' in an empty directory`,
    );
  }
}

function assertDirectoryNameMatchesNormalized(targetDir: string): string {
  const dirName = basename(targetDir);
  const normalizedName = normalizeSkillName(dirName);

  if (dirName !== normalizedName) {
    throw new Error(
      `directory name '${dirName}' must already be normalized. Rename it to '${normalizedName}' and retry`,
    );
  }

  return normalizedName;
}

export function scaffoldSkillInDirectory(targetDir: string): ScaffoldResult {
  const skillName = assertDirectoryNameMatchesNormalized(targetDir);
  assertDirectoryEmpty(targetDir);

  const directories = ["scripts", "references", "assets"] as const;

  for (const directory of directories) {
    const fullPath = join(targetDir, directory);
    mkdirSync(fullPath, { recursive: true });
    writeFileSync(join(fullPath, ".gitkeep"), "", "utf8");
  }

  writeFileSync(join(targetDir, "SKILL.md"), buildSkillMarkdown(skillName), "utf8");
  writeFileSync(join(targetDir, ".gitignore"), buildGitignore(), "utf8");

  return { skillName };
}
