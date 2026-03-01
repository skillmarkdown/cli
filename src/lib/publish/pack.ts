import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";

import { PUBLISH_MEDIA_TYPE, type PackedArtifact, type PackedFileEntry } from "./types";

const BLOCK_SIZE = 512;
const IGNORED_DIRECTORY_NAMES = new Set([".git", "node_modules", ".skillmd"]);
const IGNORED_FILE_NAMES = new Set([".DS_Store"]);

function sha256Hex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function pad(value: Buffer): Buffer {
  const remainder = value.length % BLOCK_SIZE;
  if (remainder === 0) {
    return value;
  }

  return Buffer.concat([value, Buffer.alloc(BLOCK_SIZE - remainder)]);
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function shouldSkipDirectory(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name);
}

function shouldSkipFile(name: string): boolean {
  return IGNORED_FILE_NAMES.has(name);
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

    const relativePath = toPosixPath(relative(targetDir, absolutePath));
    files.push(relativePath);
  }
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

function writeOctal(value: number, width: number): Buffer {
  const octal = value.toString(8);
  if (octal.length > width - 1) {
    throw new Error(`numeric field overflow for tar header: ${value}`);
  }

  const result = Buffer.alloc(width, 0);
  const encoded = octal.padStart(width - 1, "0");
  result.write(encoded, 0, width - 1, "ascii");
  return result;
}

function splitTarPath(pathValue: string): { name: string; prefix: string } {
  const normalized = posix.normalize(pathValue).replace(/^\/+/, "");
  const pathBytes = Buffer.byteLength(normalized);
  if (pathBytes <= 100) {
    return { name: normalized, prefix: "" };
  }

  const parts = normalized.split("/");
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const prefix = parts.slice(0, index).join("/");
    const name = parts.slice(index).join("/");

    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
      return { name, prefix };
    }
  }

  throw new Error(`path too long for canonical tar header: ${pathValue}`);
}

function createTarHeader(pathValue: string, size: number): Buffer {
  const header = Buffer.alloc(BLOCK_SIZE, 0);
  const { name, prefix } = splitTarPath(pathValue);

  header.write(name, 0, 100, "utf8");
  writeOctal(0o644, 8).copy(header, 100);
  writeOctal(0, 8).copy(header, 108);
  writeOctal(0, 8).copy(header, 116);
  writeOctal(size, 12).copy(header, 124);
  writeOctal(0, 12).copy(header, 136);

  for (let index = 148; index < 156; index += 1) {
    header[index] = 0x20;
  }

  header[156] = "0".charCodeAt(0);
  header.write("ustar", 257, 5, "ascii");
  header[262] = 0;
  header.write("00", 263, 2, "ascii");
  header.write(prefix, 345, 155, "utf8");

  let checksum = 0;
  for (const byte of header.values()) {
    checksum += byte;
  }

  const checksumField = Buffer.alloc(8, 0);
  const encoded = checksum.toString(8).padStart(6, "0");
  checksumField.write(encoded, 0, 6, "ascii");
  checksumField[6] = 0;
  checksumField[7] = 0x20;
  checksumField.copy(header, 148);

  return header;
}

function buildCanonicalTar(
  targetDir: string,
  files: string[],
): { tar: Buffer; entries: PackedFileEntry[] } {
  const chunks: Buffer[] = [];
  const entries: PackedFileEntry[] = [];

  for (const relativePath of files) {
    const absolutePath = join(targetDir, relativePath);
    const stats = statSync(absolutePath);
    const content = readFileSync(absolutePath);

    chunks.push(createTarHeader(relativePath, stats.size));
    chunks.push(pad(content));

    entries.push({
      path: relativePath,
      sizeBytes: stats.size,
      sha256: sha256Hex(content),
    });
  }

  chunks.push(Buffer.alloc(BLOCK_SIZE));
  chunks.push(Buffer.alloc(BLOCK_SIZE));

  return { tar: Buffer.concat(chunks), entries };
}

export function packSkillArtifact(targetDir: string): PackedArtifact {
  const files: string[] = [];
  collectFiles(targetDir, targetDir, files);
  files.sort(comparePathLexicographically);

  const { tar, entries } = buildCanonicalTar(targetDir, files);
  const tarGz = gzipSync(tar, { level: 9, mtime: 0 } as { level: number; mtime: number });

  return {
    mediaType: PUBLISH_MEDIA_TYPE,
    tarGz,
    digest: `sha256:${sha256Hex(tarGz)}`,
    sizeBytes: tarGz.length,
    files: entries,
  };
}
