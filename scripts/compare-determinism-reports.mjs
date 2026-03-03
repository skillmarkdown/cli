#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function walkForReports(rootDir, output) {
  const entries = readdirSync(rootDir);
  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkForReports(fullPath, output);
      continue;
    }
    if (entry === "determinism-report.json") {
      output.push(fullPath);
    }
  }
}

function loadReports(rootDir) {
  const reportPaths = [];
  walkForReports(rootDir, reportPaths);
  if (reportPaths.length === 0) {
    throw new Error(`no determinism-report.json files found under ${rootDir}`);
  }
  if (reportPaths.length < 3) {
    throw new Error(
      `expected at least 3 determinism reports (ubuntu/macos/windows), found ${reportPaths.length}`,
    );
  }
  return reportPaths.map((path) => {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { path, report: parsed };
  });
}

function assertLocalChecks(reportEntry) {
  const checks = reportEntry.report?.checks;
  if (!checks || typeof checks !== "object") {
    throw new Error(`${reportEntry.path}: missing checks object`);
  }
  if (!checks.repeatStable || !checks.ignoredChangeStable || !checks.includedChangeMutates) {
    throw new Error(`${reportEntry.path}: local determinism checks did not pass`);
  }
}

function assertCrossOsMatch(entries) {
  const [baselineEntry, ...rest] = entries;
  const expectedDigest = baselineEntry.report?.baseline?.digest;
  const expectedSize = baselineEntry.report?.baseline?.sizeBytes;

  if (typeof expectedDigest !== "string" || typeof expectedSize !== "number") {
    throw new Error(`${baselineEntry.path}: missing baseline digest/size`);
  }

  for (const entry of rest) {
    const digest = entry.report?.baseline?.digest;
    const size = entry.report?.baseline?.sizeBytes;
    if (digest !== expectedDigest || size !== expectedSize) {
      throw new Error(
        `cross-OS mismatch between ${baselineEntry.path} and ${entry.path}: ` +
          `expected ${expectedDigest} (${expectedSize}), got ${digest} (${size})`,
      );
    }
  }
}

function main() {
  const reportsRoot = resolve(process.argv[2] ?? ".");
  const reports = loadReports(reportsRoot);

  for (const entry of reports) {
    assertLocalChecks(entry);
  }

  assertCrossOsMatch(reports);

  console.log("Cross-OS determinism reports matched.");
  for (const entry of reports) {
    console.log(
      `- ${entry.report.os} ${entry.report.nodeVersion}: ` +
        `${entry.report.baseline.digest} (${entry.report.baseline.sizeBytes})`,
    );
  }
}

main();
