import { chmodSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { normalizeSkillName } from "./normalize-name";
import { INIT_TEMPLATE_IDS, type InitTemplateId, SCAFFOLD_DIRECTORIES } from "./skill-spec";
import {
  buildAssetsReadme,
  buildExtractScriptPython,
  buildFormsReference,
  buildGitignore,
  buildLookupTableCsv,
  buildMinimalSkillMarkdown,
  buildReferenceGuide,
  buildReportTemplate,
  buildScriptsReadme,
  buildVerboseSkillMarkdown,
} from "./templates";

export interface ScaffoldResult {
  skillName: string;
  template: InitTemplateId;
}

interface ScaffoldOptions {
  template?: InitTemplateId;
}

interface CreatedPath {
  kind: "file" | "dir";
  path: string;
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

export function isInitTemplateId(value: string): value is InitTemplateId {
  return INIT_TEMPLATE_IDS.includes(value as InitTemplateId);
}

export function resolveInitTemplateId(value: string): InitTemplateId | null {
  return isInitTemplateId(value) ? value : null;
}

function createDirectory(path: string, createdPaths: CreatedPath[]): void {
  mkdirSync(path, { recursive: false, mode: 0o755 });
  createdPaths.push({ kind: "dir", path });
}

function createFile(path: string, content: string, createdPaths: CreatedPath[]): void {
  writeFileSync(path, content, { encoding: "utf8", flag: "wx", mode: 0o644 });
  chmodSync(path, 0o644);
  createdPaths.push({ kind: "file", path });
}

function rollbackCreatedPaths(createdPaths: CreatedPath[]): void {
  for (const entry of [...createdPaths].reverse()) {
    if (entry.kind === "file") {
      rmSync(entry.path, { force: true });
      continue;
    }

    rmSync(entry.path, { recursive: true, force: true });
  }
}

export function scaffoldSkillInDirectory(
  targetDir: string,
  options: ScaffoldOptions = {},
): ScaffoldResult {
  const template = options.template ?? "minimal";
  const skillName = assertDirectoryNameMatchesNormalized(targetDir);
  assertDirectoryEmpty(targetDir);

  const createdPaths: CreatedPath[] = [];

  try {
    if (template === "verbose") {
      for (const directory of SCAFFOLD_DIRECTORIES) {
        const fullPath = join(targetDir, directory);
        createDirectory(fullPath, createdPaths);
        createFile(join(fullPath, ".gitkeep"), "", createdPaths);
      }

      createFile(join(targetDir, ".gitignore"), buildGitignore(), createdPaths);
      createFile(join(targetDir, "SKILL.md"), buildVerboseSkillMarkdown(skillName), createdPaths);
      createFile(join(targetDir, "scripts", "README.md"), buildScriptsReadme(), createdPaths);
      createFile(
        join(targetDir, "scripts", "extract.py"),
        buildExtractScriptPython(),
        createdPaths,
      );
      createFile(
        join(targetDir, "references", "REFERENCE.md"),
        buildReferenceGuide(),
        createdPaths,
      );
      createFile(join(targetDir, "references", "FORMS.md"), buildFormsReference(), createdPaths);
      createFile(join(targetDir, "assets", "README.md"), buildAssetsReadme(), createdPaths);
      createFile(
        join(targetDir, "assets", "report-template.md"),
        buildReportTemplate(),
        createdPaths,
      );
      createFile(
        join(targetDir, "assets", "lookup-table.csv"),
        buildLookupTableCsv(),
        createdPaths,
      );
      return { skillName, template };
    }

    createFile(join(targetDir, "SKILL.md"), buildMinimalSkillMarkdown(skillName), createdPaths);
    return { skillName, template };
  } catch (error) {
    rollbackCreatedPaths(createdPaths);
    throw error;
  }
}
