import { resolve } from "node:path";

import { type ValidationResult, validateSkill } from "../lib/validator";
import { type UpstreamValidationResult, validateWithSkillsRef } from "../lib/upstream-validator";

interface ValidateCommandOptions {
  cwd?: string;
  validateLocal?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
  validateUpstream?: (targetDir: string) => UpstreamValidationResult;
}

export function runValidateCommand(args: string[], options: ValidateCommandOptions = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const validateLocal = options.validateLocal ?? validateSkill;
  const validateUpstream = options.validateUpstream ?? validateWithSkillsRef;
  let strict = false;
  let parity = false;
  let pathArg: string | undefined;

  for (const arg of args) {
    if (arg === "--strict") {
      strict = true;
      continue;
    }

    if (arg === "--parity") {
      parity = true;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`skillmd validate: unsupported flag '${arg}'`);
      console.error("Usage: skillmd validate [path] [--strict] [--parity]");
      return 1;
    }

    if (pathArg) {
      console.error("skillmd validate: accepts at most one path argument");
      console.error("Usage: skillmd validate [path] [--strict] [--parity]");
      return 1;
    }

    pathArg = arg;
  }

  const targetDir = pathArg ? resolve(cwd, pathArg) : cwd;
  const validation = validateLocal(targetDir, { strict });

  if (parity) {
    const upstream = validateUpstream(targetDir);
    if (upstream.status === "unavailable") {
      console.error(
        `Validation parity unavailable: ${upstream.message}. Install skills-ref to use --parity.`,
      );
      return 1;
    }

    if (validation.status === "passed" && upstream.status !== "passed") {
      console.error("Validation parity mismatch: local validation passed but skills-ref failed.");
      console.error(`skills-ref: ${upstream.message}`);
      return 1;
    }

    if (validation.status === "failed" && upstream.status !== "failed") {
      console.error("Validation parity mismatch: local validation failed but skills-ref passed.");
      return 1;
    }
  }

  if (validation.status === "passed") {
    console.log(`Validation passed: ${validation.message}`);
    if (parity) {
      console.log("Validation parity passed (skills-ref).");
    }
    return 0;
  }

  console.error(`Validation failed: ${validation.message}`);
  if (parity) {
    console.error("Validation parity matched (skills-ref also failed).");
  }
  return 1;
}
