#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { hasPackedFile, parsePackJson, summarizeByTopLevel } from "./check-pack-size-lib.mjs";

const MAX_UNPACKED_BYTES = 130_000;

function formatBytes(value) {
  return `${value.toLocaleString("en-US")} B`;
}

const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const payload = parsePackJson(raw);
const unpackedSize = typeof payload.unpackedSize === "number" ? payload.unpackedSize : 0;
const packedSize = typeof payload.size === "number" ? payload.size : 0;
const files = Array.isArray(payload.files) ? payload.files : [];
if (!hasPackedFile(files, "dist/cli.js")) {
  console.error("Pack size check failed: npm pack output does not contain dist/cli.js.");
  console.error("Run 'npm run build' before running check:pack-size.");
  process.exit(1);
}

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

const delta = unpackedSize - MAX_UNPACKED_BYTES;
if (delta <= 0) {
  console.log(`Delta to limit: ${formatBytes(Math.abs(delta))} under.`);
} else {
  console.log(`Delta to limit: ${formatBytes(delta)} over.`);
}

if (unpackedSize > MAX_UNPACKED_BYTES) {
  console.error(
    `Pack size check failed: unpacked size ${formatBytes(unpackedSize)} exceeds limit ${formatBytes(MAX_UNPACKED_BYTES)}.`,
  );
  process.exit(1);
}

console.log("Pack size check passed.");
