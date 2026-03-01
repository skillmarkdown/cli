import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";

import {
  MAX_SKILL_NAME_LENGTH,
  STRICT_REQUIRED_FILES,
  STRICT_SECTION_HEADINGS,
} from "../scaffold/skill-spec";

export type ValidationStatus = "passed" | "failed";

export interface ValidationResult {
  status: ValidationStatus;
  message: string;
}

interface ValidationOptions {
  strict?: boolean;
}

interface ParsedSkill {
  frontmatter: Record<string, unknown>;
}

const SKILL_FILE = "SKILL.md";

function stripUtf8Bom(content: string): string {
  return content.replace(/^\uFEFF/, "");
}

function readSkillContentIfExists(targetDir: string): string | null {
  const skillPath = join(targetDir, SKILL_FILE);
  return existsSync(skillPath) ? readFileSync(skillPath, "utf8") : null;
}

function extractFrontmatter(content: string): ParsedSkill | null {
  const normalizedContent = stripUtf8Bom(content);
  const match = normalizedContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match || typeof match[1] !== "string") {
    return null;
  }

  try {
    const parsed = parse(match[1]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return { frontmatter: parsed as Record<string, unknown> };
  } catch {
    return null;
  }
}

function isValidSkillName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_SKILL_NAME_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
  );
}

function isStringMap(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function collectSpecErrors(targetDir: string): string[] {
  const skillContent = readSkillContentIfExists(targetDir);
  if (!skillContent) {
    return [`missing required file: ${SKILL_FILE}`];
  }

  const parsedSkill = extractFrontmatter(skillContent);
  if (!parsedSkill) {
    return ["SKILL.md must start with valid YAML frontmatter"];
  }

  const errors: string[] = [];
  const { frontmatter } = parsedSkill;
  const directoryName = basename(targetDir);

  const name = frontmatter.name;
  if (typeof name !== "string" || name.length === 0) {
    errors.push("frontmatter is missing required string field: name");
  } else {
    if (!isValidSkillName(name)) {
      errors.push(
        `frontmatter 'name' must be 1-${MAX_SKILL_NAME_LENGTH} chars using lowercase letters, numbers, and single hyphens`,
      );
    }

    if (name !== directoryName) {
      errors.push(`frontmatter 'name' (${name}) must match directory name (${directoryName})`);
    }
  }

  const description = frontmatter.description;
  if (typeof description !== "string" || description.trim().length === 0) {
    errors.push("frontmatter is missing required non-empty string field: description");
  } else if (description.length > 1024) {
    errors.push("frontmatter 'description' must be at most 1024 characters");
  }

  if (frontmatter.license !== undefined && typeof frontmatter.license !== "string") {
    errors.push("frontmatter 'license' must be a string when provided");
  }

  const compatibility = frontmatter.compatibility;
  if (compatibility !== undefined) {
    if (typeof compatibility !== "string") {
      errors.push("frontmatter 'compatibility' must be a string when provided");
    } else if (compatibility.length < 1 || compatibility.length > 500) {
      errors.push("frontmatter 'compatibility' must be 1-500 characters");
    }
  }

  if (frontmatter.metadata !== undefined && !isStringMap(frontmatter.metadata)) {
    errors.push("frontmatter 'metadata' must be a mapping of string keys to string values");
  }

  const allowedTools = frontmatter["allowed-tools"];
  if (allowedTools !== undefined && typeof allowedTools !== "string") {
    errors.push("frontmatter 'allowed-tools' must be a string when provided");
  }

  return errors;
}

function collectStrictScaffoldErrors(targetDir: string): string[] {
  const missingStrictFiles = STRICT_REQUIRED_FILES.filter(
    (requiredFile) => !existsSync(join(targetDir, requiredFile)),
  ).map((requiredFile) => `missing strict scaffold file: ${requiredFile}`);

  const skillContent = readSkillContentIfExists(targetDir);
  if (!skillContent) {
    return missingStrictFiles;
  }

  const missingStrictSections = STRICT_SECTION_HEADINGS.filter(
    (section) => !hasHeadingOutsideFencedCode(skillContent, section),
  ).map((section) => `SKILL.md is missing strict section: ${section}`);

  return [...missingStrictFiles, ...missingStrictSections];
}

function hasHeadingOutsideFencedCode(content: string, heading: string): boolean {
  const headingPattern = new RegExp(`^\\s{0,3}${escapeRegExp(heading)}\\s*$`);
  let activeFence: "```" | "~~~" | null = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const fence = trimmed.startsWith("```") ? "```" : "~~~";
      activeFence = activeFence === fence ? null : (activeFence ?? fence);
      continue;
    }

    if (!activeFence && headingPattern.test(line.replace(/\r$/, ""))) {
      return true;
    }
  }

  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateSkill(
  targetDir: string,
  options: ValidationOptions = {},
): ValidationResult {
  const errors = collectSpecErrors(targetDir);
  if (options.strict) {
    errors.push(...collectStrictScaffoldErrors(targetDir));
  }

  if (errors.length === 0) {
    return {
      status: "passed",
      message: options.strict
        ? "Spec and strict scaffold validation passed."
        : "Spec validation passed.",
    };
  }

  return {
    status: "failed",
    message: errors.join("; "),
  };
}
