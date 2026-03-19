import { mkdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { scaffoldSkillInDirectory } from "./scaffold";
import { type InitTemplateId } from "./skill-spec";
import { type ValidationResult } from "../validation/validator";

export interface ParsedInitLikeArgs {
  skipValidation: boolean;
  template: InitTemplateId;
  valid: boolean;
  target?: string;
}

export interface RunInitLikeCommandOptions {
  cwd?: string;
  validateSkill?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
}

export function parseInitLikeArgs(
  args: string[],
  options: {
    allowTarget: boolean;
    resolveTemplateId: (value: string) => InitTemplateId | null;
  },
): ParsedInitLikeArgs {
  let skipValidation = false;
  let template: InitTemplateId = "minimal";
  let target: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--no-validate") {
      skipValidation = true;
      continue;
    }

    if (arg === "--template") {
      const nextValue = args[index + 1];
      const resolved = nextValue ? options.resolveTemplateId(nextValue) : null;
      if (!resolved) {
        return { skipValidation: false, template: "minimal", valid: false };
      }
      template = resolved;
      index += 1;
      continue;
    }

    if (arg.startsWith("--template=")) {
      const value = arg.slice("--template=".length);
      const resolved = options.resolveTemplateId(value);
      if (!resolved) {
        return { skipValidation: false, template: "minimal", valid: false };
      }
      template = resolved;
      continue;
    }

    if (options.allowTarget && !arg.startsWith("--") && !target) {
      target = arg;
      continue;
    }

    return { skipValidation: false, template: "minimal", valid: false };
  }

  return { skipValidation, template, valid: true, target };
}

export function runInitLikeCommand(
  targetDir: string,
  options: {
    skipValidation: boolean;
    template: InitTemplateId;
    validateSkill?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
    commandName: "init" | "create";
    successMessage: (result: { skillName: string; template: InitTemplateId }) => string;
    onBeforeScaffold?: () => void;
  },
): number {
  const validateSkillFn = options.validateSkill;

  try {
    options.onBeforeScaffold?.();
    const result = scaffoldSkillInDirectory(targetDir, { template: options.template });
    console.log(options.successMessage(result));

    if (options.skipValidation) {
      console.log("Validation skipped (--no-validate).");
      return 0;
    }

    const validation = validateSkillFn?.(targetDir, { strict: result.template === "verbose" });
    if (!validation) {
      return 0;
    }

    if (validation.status === "passed") {
      console.log(`Validation passed: ${validation.message}`);
      return 0;
    }

    console.error(`Validation failed: ${validation.message}`);
    console.error("Run 'skillmd validate' after fixing issues.");
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd ${options.commandName}: ${message}`);
    return 1;
  }
}

export function resolveCreateTarget(cwd: string, target: string): string {
  return resolvePath(cwd, target);
}

export function createTargetDirectory(targetDir: string): void {
  mkdirSync(targetDir, { recursive: false, mode: 0o755 });
}
