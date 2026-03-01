import { INIT_USAGE } from "../lib/cli-text";
import { failWithUsage, printValidationResult } from "../lib/command-output";
import { resolveInitTemplateId, scaffoldSkillInDirectory } from "../lib/scaffold";
import { type InitTemplateId } from "../lib/skill-spec";
import { type ValidationResult, validateSkill } from "../lib/validator";

interface InitCommandOptions {
  cwd?: string;
  validateSkill?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
}

interface ParsedInitArgs {
  skipValidation: boolean;
  template: InitTemplateId;
  valid: boolean;
}

function parseInitArgs(args: string[]): ParsedInitArgs {
  let skipValidation = false;
  let template: InitTemplateId = "minimal";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--no-validate") {
      skipValidation = true;
      continue;
    }

    if (arg === "--template") {
      const nextValue = args[index + 1];
      const resolved = nextValue ? resolveInitTemplateId(nextValue) : null;
      if (!resolved) {
        return { skipValidation: false, template: "minimal", valid: false };
      }
      template = resolved;
      index += 1;
      continue;
    }

    if (arg.startsWith("--template=")) {
      const value = arg.slice("--template=".length);
      const resolved = resolveInitTemplateId(value);
      if (!resolved) {
        return { skipValidation: false, template: "minimal", valid: false };
      }
      template = resolved;
      continue;
    }

    return { skipValidation: false, template: "minimal", valid: false };
  }

  return { skipValidation, template, valid: true };
}

export function runInitCommand(args: string[], options: InitCommandOptions = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const validateSkillFn = options.validateSkill ?? validateSkill;
  const { skipValidation, template, valid } = parseInitArgs(args);

  if (!valid) {
    return failWithUsage("skillmd init: unsupported argument(s)", INIT_USAGE);
  }

  try {
    const result = scaffoldSkillInDirectory(cwd, { template });
    console.log(`Initialized skill '${result.skillName}'.`);

    if (skipValidation) {
      console.log("Validation skipped (--no-validate).");
      return 0;
    }

    const validation = validateSkillFn(cwd, { strict: result.template === "verbose" });
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
