import { CliApiError } from "../shared/api-errors";

export class AccountApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("AccountApiError", status, code, message, details);
  }
}

export function isAccountApiError(error: unknown): error is AccountApiError {
  return error instanceof AccountApiError;
}
