import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";

export type ValidationStatus = "passed" | "failed";

export interface ValidationResult {
  status: ValidationStatus;
  message: string;
}

interface ValidationOptions {
  strict?: boolean;
}

const STRICT_REQUIRED_FILES = [
  ".gitignore",
  "scripts/.gitkeep",
  "references/.gitkeep",
  "assets/.gitkeep",
] as const;

const REQUIRED_SECTIONS = [
  "## Scope",
  "## When to use",
  "## Inputs",
  "## Outputs",
  "## Steps / Procedure",
  "## Examples",
  "## Limitations / Failure modes",
  "## Security / Tool access",
] as const;

interface ParsedSkill {
  frontmatter: Record<string, unknown>;
}

function stripUtf8Bom(content: string): string {
  return content.replace(/^\uFEFF/, "");
}

function extractFrontmatter(content: string): ParsedSkill | null {
  const normalizedContent = stripUtf8Bom(content);
  const match = normalizedContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match || typeof match[1] !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parse(match[1]);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return {
    frontmatter: parsed as Record<string, unknown>,
  };
}

function isValidSkillName(name: string): boolean {
  if (name.length === 0 || name.length > 64) {
    return false;
  }

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}

function collectSpecErrors(targetDir: string): string[] {
  const errors: string[] = [];
  const skillPath = join(targetDir, "SKILL.md");

  if (!existsSync(skillPath)) {
    errors.push("missing required file: SKILL.md");
    return errors;
  }

  const skillContent = readFileSync(skillPath, "utf8");
  const parsedSkill = extractFrontmatter(skillContent);

  if (!parsedSkill) {
    errors.push("SKILL.md must start with valid YAML frontmatter");
    return errors;
  }

  const { frontmatter } = parsedSkill;
  const name = frontmatter.name;
  const description = frontmatter.description;
  const license = frontmatter.license;
  const compatibility = frontmatter.compatibility;
  const metadata = frontmatter.metadata;
  const allowedTools = frontmatter["allowed-tools"];
  const directoryName = basename(targetDir);

  if (typeof name !== "string" || name.length === 0) {
    errors.push("frontmatter is missing required string field: name");
  } else {
    if (!isValidSkillName(name)) {
      errors.push(
        "frontmatter 'name' must be 1-64 chars using lowercase letters, numbers, and single hyphens",
      );
    }

    if (name !== directoryName) {
      errors.push(`frontmatter 'name' (${name}) must match directory name (${directoryName})`);
    }
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    errors.push("frontmatter is missing required non-empty string field: description");
  } else if (description.length > 1024) {
    errors.push("frontmatter 'description' must be at most 1024 characters");
  }

  if (license !== undefined && typeof license !== "string") {
    errors.push("frontmatter 'license' must be a string when provided");
  }

  if (compatibility !== undefined) {
    if (typeof compatibility !== "string") {
      errors.push("frontmatter 'compatibility' must be a string when provided");
    } else if (compatibility.length < 1 || compatibility.length > 500) {
      errors.push("frontmatter 'compatibility' must be 1-500 characters");
    }
  }

  if (metadata !== undefined && !isStringMap(metadata)) {
    errors.push("frontmatter 'metadata' must be a mapping of string keys to string values");
  }

  if (allowedTools !== undefined && typeof allowedTools !== "string") {
    errors.push("frontmatter 'allowed-tools' must be a string when provided");
  }

  return errors;
}

function collectStrictScaffoldErrors(targetDir: string): string[] {
  const errors: string[] = [];

  for (const requiredFile of STRICT_REQUIRED_FILES) {
    if (!existsSync(join(targetDir, requiredFile))) {
      errors.push(`missing strict scaffold file: ${requiredFile}`);
    }
  }

  const skillPath = join(targetDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    return errors;
  }

  const skillContent = readFileSync(skillPath, "utf8");
  for (const section of REQUIRED_SECTIONS) {
    if (!hasHeadingOutsideFencedCode(skillContent, section)) {
      errors.push(`SKILL.md is missing strict section: ${section}`);
    }
  }

  return errors;
}

function hasHeadingOutsideFencedCode(content: string, heading: string): boolean {
  const lines = content.split(/\r?\n/);
  const headingPattern = new RegExp(`^\\s{0,3}${escapeRegExp(heading)}\\s*$`);
  let activeFence: "```" | "~~~" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const fence = trimmed.startsWith("```") ? "```" : "~~~";
      if (activeFence === null) {
        activeFence = fence;
        continue;
      }

      if (activeFence === fence) {
        activeFence = null;
        continue;
      }
    }

    if (activeFence) {
      continue;
    }

    if (headingPattern.test(line.replace(/\r$/, ""))) {
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
