export class HistoryApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HistoryApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isHistoryApiError(error: unknown): error is HistoryApiError {
  return error instanceof HistoryApiError;
}
