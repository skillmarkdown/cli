import { CliApiError } from "../shared/api-errors";

export class ViewApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("ViewApiError", status, code, message, details);
  }
}

export function isViewApiError(error: unknown): error is ViewApiError {
  return error instanceof ViewApiError;
}
