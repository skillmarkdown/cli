import { type ValidationResult } from "../validation/validator";
import { printJson } from "./json-output";

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

export function printCommandResult(json: boolean, payload: unknown, human: () => void): void {
  if (json) {
    printJson(payload);
    return;
  }
  human();
}

export function printWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    console.error(`Warning: ${warning}`);
  }
}

export function printNextStep(command: string): void {
  console.log(`Next: ${command}`);
}

export function printSummary(label: string, parts: string[]): void {
  console.log(`${label}: ${parts.join(" ")}`);
}

export function printLoginRequired(prefix: string, reason = "not logged in"): void {
  console.error(`${prefix}: ${reason}. Run 'skillmd login' first.`);
}
