import { INIT_USAGE } from "../lib/cli-text";
import { failWithUsage, printValidationResult } from "../lib/command-output";
import { scaffoldSkillInDirectory } from "../lib/scaffold";
import { type ValidationResult, validateSkill } from "../lib/validator";

interface InitCommandOptions {
  cwd?: string;
  validateSkill?: (targetDir: string) => ValidationResult;
}

export function runInitCommand(args: string[], options: InitCommandOptions = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const validateSkillFn =
    options.validateSkill ?? ((targetDir: string) => validateSkill(targetDir, { strict: true }));

  const skipValidation = args.includes("--no-validate");
  const hasUnsupportedArgs = args.length > 1 || (args.length === 1 && args[0] !== "--no-validate");

  if (hasUnsupportedArgs) {
    return failWithUsage("skillmd init: unsupported argument(s)", INIT_USAGE);
  }

  try {
    const result = scaffoldSkillInDirectory(cwd);
    console.log(`Initialized skill '${result.skillName}'.`);

    if (skipValidation) {
      console.log("Validation skipped (--no-validate).");
      return 0;
    }

    const validation = validateSkillFn(cwd);
    printValidationResult(validation);
    if (validation.status === "passed") {
      return 0;
    }

    console.error("Run 'skillmd validate' after fixing issues.");
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd init: ${message}`);
    return 1;
  }
}
