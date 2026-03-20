import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

const IGNORED_DIRECTORY_NAMES = new Set([
  ".agent",
  ".agents",
  ".openai",
  ".claude",
  ".gemini",
  ".meta",
  ".mistral",
  ".deepseek",
  ".perplexity",
  ".git",
  "node_modules",
  ".skillmd",
]);
const IGNORED_FILE_NAMES = new Set([".DS_Store"]);
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\..*)?$/iu,
  /^\.npmrc$/iu,
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/iu,
  /\.(?:pem|key|p12|pfx)$/iu,
];

const ALLOWED_PUBLISH_TEXT_EXTENSIONS = new Set([
  ".bash",
  ".cjs",
  ".conf",
  ".css",
  ".csv",
  ".cts",
  ".env.example",
  ".fish",
  ".graphql",
  ".gql",
  ".html",
  ".ini",
  ".js",
  ".json",
  ".jsx",
  ".lock",
  ".md",
  ".mjs",
  ".mts",
  ".properties",
  ".ps1",
  ".py",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);
const ALLOWED_PUBLISH_TEXT_FILE_NAMES = new Set([
  ".editorconfig",
  ".gitignore",
  ".gitkeep",
  "dockerfile",
  "license",
  "licence",
  "makefile",
]);
const BINARY_SAMPLE_BYTES = 8192;
const MAX_SUSPICIOUS_BINARY_RATIO = 0.1;

export type PublishContentBlockReason = "unsupported-file-type" | "binary-content-detected";

export interface PublishContentPolicyViolation {
  path: string;
  reason: PublishContentBlockReason;
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function shouldSkipDirectory(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name);
}

function shouldSkipFile(name: string): boolean {
  if (IGNORED_FILE_NAMES.has(name)) {
    return true;
  }

  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function comparePathLexicographically(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function collectFiles(targetDir: string, cursorDir: string, files: string[]): void {
  const entries = readdirSync(cursorDir, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    const absolutePath = join(cursorDir, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      collectFiles(targetDir, absolutePath, files);
      continue;
    }

    if (!entry.isFile() || shouldSkipFile(entry.name)) {
      continue;
    }

    files.push(toPosixPath(relative(targetDir, absolutePath)));
  }
}

export function listPublishableSkillFiles(targetDir: string): string[] {
  const files: string[] = [];
  collectFiles(targetDir, targetDir, files);
  files.sort(comparePathLexicographically);
  return files;
}

function isAllowedPublishTextFile(file: string): boolean {
  const normalizedBaseName = basename(file).toLowerCase();
  if (ALLOWED_PUBLISH_TEXT_FILE_NAMES.has(normalizedBaseName)) {
    return true;
  }

  const normalizedPath = file.toLowerCase();
  for (const extension of ALLOWED_PUBLISH_TEXT_EXTENSIONS) {
    if (normalizedPath.endsWith(extension)) {
      return true;
    }
  }

  return false;
}

function appearsBinaryContent(sample: Buffer): boolean {
  if (sample.length === 0) {
    return false;
  }

  let suspiciousByteCount = 0;

  for (const byte of sample.values()) {
    if (byte === 0) {
      return true;
    }

    const isAllowedControl = byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d;
    const isSuspiciousControl = (byte < 0x20 && !isAllowedControl) || byte === 0x7f;
    if (isSuspiciousControl) {
      suspiciousByteCount += 1;
    }
  }

  return suspiciousByteCount / sample.length > MAX_SUSPICIOUS_BINARY_RATIO;
}

export function findBlockedPublishContentFiles(
  targetDir: string,
  files: string[],
): PublishContentPolicyViolation[] {
  const blocked: PublishContentPolicyViolation[] = [];

  for (const file of files) {
    if (!isAllowedPublishTextFile(file)) {
      blocked.push({ path: file, reason: "unsupported-file-type" });
      continue;
    }

    const sample = readFileSync(join(targetDir, file)).subarray(0, BINARY_SAMPLE_BYTES);
    if (appearsBinaryContent(sample)) {
      blocked.push({ path: file, reason: "binary-content-detected" });
    }
  }

  return blocked;
}

export function formatBlockedPublishContentMessage(
  violations: PublishContentPolicyViolation[],
): string {
  const entries = violations.map(({ path, reason }) => {
    const description =
      reason === "unsupported-file-type" ? "unsupported file type" : "binary content detected";
    return `'${path}' (${description})`;
  });

  return (
    "published skills must contain only reviewable text-first files; remove or convert: " +
    entries.join(", ")
  );
}
