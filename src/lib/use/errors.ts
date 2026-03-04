import { CliApiError } from "../shared/api-errors";

export class UseApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("UseApiError", status, code, message, details);
  }
}

export function isUseApiError(error: unknown): error is UseApiError {
  return error instanceof UseApiError;
}
