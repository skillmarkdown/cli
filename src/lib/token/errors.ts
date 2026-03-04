import { CliApiError } from "../shared/api-errors";

export class TokenApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("TokenApiError", status, code, message, details);
  }
}

export function isTokenApiError(error: unknown): error is TokenApiError {
  return error instanceof TokenApiError;
}
