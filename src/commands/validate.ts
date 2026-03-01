import { resolve } from "node:path";

import { VALIDATE_USAGE } from "../lib/cli-text";
import { failWithUsage, printValidationResult } from "../lib/command-output";
import { type UpstreamValidationResult, validateWithSkillsRef } from "../lib/upstream-validator";
import { type ValidationResult, validateSkill } from "../lib/validator";

interface ValidateCommandOptions {
  cwd?: string;
  validateLocal?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
  validateUpstream?: (targetDir: string) => UpstreamValidationResult;
}

export function runValidateCommand(args: string[], options: ValidateCommandOptions = {}): number {
  try {
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
        return failWithUsage(`skillmd validate: unsupported flag '${arg}'`, VALIDATE_USAGE);
      }

      if (pathArg) {
        return failWithUsage("skillmd validate: accepts at most one path argument", VALIDATE_USAGE);
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

    printValidationResult(validation);
    if (validation.status === "passed") {
      if (parity) {
        console.log("Validation parity passed (skills-ref).");
      }
      return 0;
    }

    if (parity) {
      console.error("Validation parity matched (skills-ref also failed).");
    }
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd validate: ${message}`);
    return 1;
  }
}
