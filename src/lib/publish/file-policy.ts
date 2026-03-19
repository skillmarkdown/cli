import { readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

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

const DISALLOWED_PUBLISH_MEDIA_EXTENSIONS = new Set([
  ".aac",
  ".avi",
  ".bmp",
  ".flac",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".png",
  ".wav",
  ".webm",
  ".webp",
]);

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

export function findDisallowedPublishMediaFiles(files: string[]): string[] {
  return files.filter((file) =>
    DISALLOWED_PUBLISH_MEDIA_EXTENSIONS.has(extname(file).toLowerCase()),
  );
}

export function formatDisallowedPublishMediaMessage(files: string[]): string {
  return (
    "published skills must not contain binary media files; remove: " +
    files.map((file) => `'${file}'`).join(", ")
  );
}
