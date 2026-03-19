import { existsSync } from "node:fs";
import { basename } from "node:path";

import { CREATE_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";
import { resolveInitTemplateId } from "../lib/scaffold/scaffold";
import {
  createTargetDirectory,
  parseInitLikeArgs,
  resolveCreateTarget,
  runInitLikeCommand,
} from "../lib/scaffold/init-workflow";
import { type ValidationResult, validateSkill } from "../lib/validation/validator";

interface CreateCommandOptions {
  cwd?: string;
  validateSkill?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
}

export function runCreateCommand(args: string[], options: CreateCommandOptions = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const { skipValidation, target, template, valid } = parseInitLikeArgs(args, {
    allowTarget: true,
    resolveTemplateId: resolveInitTemplateId,
  });

  if (!valid || !target) {
    return failWithUsage("skillmd create: unsupported argument(s)", CREATE_USAGE);
  }

  const targetDir = resolveCreateTarget(cwd, target);
  if (existsSync(targetDir)) {
    console.error(`skillmd create: target path already exists: ${target}`);
    return 1;
  }

  return runInitLikeCommand(targetDir, {
    skipValidation,
    template,
    validateSkill: options.validateSkill ?? validateSkill,
    commandName: "create",
    onBeforeScaffold: () => createTargetDirectory(targetDir),
    successMessage: (result) => `Created skill '${result.skillName}' in ${basename(targetDir)}.`,
  });
}
