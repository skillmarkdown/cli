import { type ValidationResult } from "../validation/validator";
import { printJson } from "./json-output";
import { type CliApiError } from "./api-errors";
import { getCliApiErrorHint, SKILLMARKDOWN_WEBSITE_URL } from "./authz-error-hints";

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
  console.error(`${prefix}: ${reason}. Run 'skillmd login' first at ${SKILLMARKDOWN_WEBSITE_URL}.`);
}

interface JsonErrorEnvelope {
  ok: false;
  error: {
    type: "auth" | "api" | "internal" | "validation";
    message: string;
    code?: string;
    status?: number;
    details?: unknown;
    hint?: string;
  };
}

export function printJsonError(
  type: JsonErrorEnvelope["error"]["type"],
  message: string,
  options: {
    code?: string;
    status?: number;
    details?: unknown;
    hint?: string | null;
  } = {},
): void {
  printJson({
    ok: false,
    error: {
      type,
      message,
      ...(options.code ? { code: options.code } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      ...(options.details !== undefined ? { details: options.details } : {}),
      ...(options.hint ? { hint: options.hint } : {}),
    },
  });
}

export function printJsonApiError(error: CliApiError): void {
  printJsonError("api", error.message, {
    code: error.code,
    status: error.status,
    details: error.details,
    hint: getCliApiErrorHint(error),
  });
}
