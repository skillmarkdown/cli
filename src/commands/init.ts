import { INIT_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";
import { resolveInitTemplateId } from "../lib/scaffold/scaffold";
import { parseInitLikeArgs, runInitLikeCommand } from "../lib/scaffold/init-workflow";
import { type ValidationResult, validateSkill } from "../lib/validation/validator";

interface InitCommandOptions {
  cwd?: string;
  validateSkill?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
}

export function runInitCommand(args: string[], options: InitCommandOptions = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const { skipValidation, template, valid } = parseInitLikeArgs(args, {
    allowTarget: false,
    resolveTemplateId: resolveInitTemplateId,
  });

  if (!valid) {
    return failWithUsage("skillmd init: unsupported argument(s)", INIT_USAGE);
  }

  return runInitLikeCommand(cwd, {
    skipValidation,
    template,
    validateSkill: options.validateSkill ?? validateSkill,
    commandName: "init",
    successMessage: (result) => `Initialized skill '${result.skillName}'.`,
  });
}
