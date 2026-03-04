#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const MAX_UNPACKED_BYTES = 235_000;

function tryParsePackPayload(candidate) {
  try {
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]) {
      return null;
    }

    const first = parsed[0];
    if (!first || typeof first !== "object") {
      return null;
    }

    return first;
  } catch {
    return null;
  }
}

function parsePackJson(output) {
  const direct = tryParsePackPayload(output.trim());
  if (direct) {
    return direct;
  }

  let cursor = output.length;
  while (cursor > 0) {
    const start = output.lastIndexOf("[", cursor - 1);
    if (start < 0) {
      break;
    }

    const parsed = tryParsePackPayload(output.slice(start).trim());
    if (parsed) {
      return parsed;
    }

    cursor = start;
  }

  throw new Error("npm pack --json did not return parseable JSON output");
}

function summarizeByTopLevel(files) {
  const byGroup = new Map();

  for (const file of files) {
    const filePath = typeof file.path === "string" ? file.path : "<unknown>";
    const size = typeof file.size === "number" ? file.size : 0;

    let group = filePath;
    if (filePath.includes("/")) {
      const [head, tail] = filePath.split("/", 2);
      group = head === "dist" && tail ? `dist/${tail.split("/")[0]}` : head;
    }

    byGroup.set(group, (byGroup.get(group) ?? 0) + size);
  }

  return [...byGroup.entries()].sort((a, b) => b[1] - a[1]);
}

function formatBytes(value) {
  return `${value.toLocaleString("en-US")} B`;
}

const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const payload = parsePackJson(raw);
const unpackedSize = typeof payload.unpackedSize === "number" ? payload.unpackedSize : 0;
const packedSize = typeof payload.size === "number" ? payload.size : 0;
const files = Array.isArray(payload.files) ? payload.files : [];

console.log(`Packed size: ${formatBytes(packedSize)}`);
console.log(
  `Unpacked size: ${formatBytes(unpackedSize)} (limit ${formatBytes(MAX_UNPACKED_BYTES)})`,
);

const grouped = summarizeByTopLevel(files).slice(0, 8);
if (grouped.length > 0) {
  console.log("Top packed groups:");
  for (const [group, size] of grouped) {
    console.log(`- ${group}: ${formatBytes(size)}`);
  }
}

if (unpackedSize > MAX_UNPACKED_BYTES) {
  console.error(
    `Pack size check failed: unpacked size ${formatBytes(unpackedSize)} exceeds limit ${formatBytes(MAX_UNPACKED_BYTES)}.`,
  );
  process.exit(1);
}

console.log("Pack size check passed.");
