import { CliApiError } from "../shared/api-errors";

export class HistoryApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("HistoryApiError", status, code, message, details);
  }
}

export function isHistoryApiError(error: unknown): error is HistoryApiError {
  return error instanceof HistoryApiError;
}
