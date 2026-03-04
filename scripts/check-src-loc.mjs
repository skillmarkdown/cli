#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_SRC_CODE_LINES = 9_200;
const SRC_ROOT = "src";

function listTypeScriptFiles(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && next.endsWith(".ts")) {
        files.push(next);
      }
    }
  }
  return files;
}

function countCodeLines(text) {
  let inBlock = false;
  let code = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end >= 0) {
        inBlock = false;
        const rest = line.slice(end + 2).trim();
        if (rest && !rest.startsWith("//")) {
          code += 1;
        }
      }
      continue;
    }
    if (line.startsWith("//")) {
      continue;
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) {
        inBlock = true;
      } else {
        const end = line.indexOf("*/");
        const rest = line.slice(end + 2).trim();
        if (rest && !rest.startsWith("//")) {
          code += 1;
        }
      }
      continue;
    }
    code += 1;
  }
  return code;
}

const files = listTypeScriptFiles(SRC_ROOT);
const totals = files.reduce(
  (acc, filePath) => {
    const text = readFileSync(filePath, "utf8");
    const lineCount = text.split(/\r?\n/).length;
    acc.total += lineCount;
    acc.code += countCodeLines(text);
    return acc;
  },
  { total: 0, code: 0 },
);

console.log(`src TypeScript files: ${files.length}`);
console.log(`src total lines: ${totals.total.toLocaleString("en-US")}`);
console.log(`src estimated code lines: ${totals.code.toLocaleString("en-US")}`);
console.log(`code line limit: ${MAX_SRC_CODE_LINES.toLocaleString("en-US")}`);

if (totals.code > MAX_SRC_CODE_LINES) {
  console.error(
    `Source LOC check failed: estimated code lines ${totals.code.toLocaleString("en-US")} exceed limit ${MAX_SRC_CODE_LINES.toLocaleString("en-US")}.`,
  );
  process.exit(1);
}

console.log("Source LOC check passed.");
