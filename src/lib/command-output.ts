import { type ValidationResult } from "./validator";

export function failWithUsage(message: string, usage: string): number {
  console.error(message);
  console.error(usage);
  return 1;
}

export function printValidationResult(validation: ValidationResult): void {
  if (validation.status === "passed") {
    console.log(`Validation passed: ${validation.message}`);
    return;
  }

  console.error(`Validation failed: ${validation.message}`);
}
