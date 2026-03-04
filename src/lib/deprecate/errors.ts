import { CliApiError } from "../shared/api-errors";

export class DeprecateApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("DeprecateApiError", status, code, message, details);
  }
}

export function isDeprecateApiError(error: unknown): error is DeprecateApiError {
  return error instanceof DeprecateApiError;
}
