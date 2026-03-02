export class UseApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "UseApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isUseApiError(error: unknown): error is UseApiError {
  return error instanceof UseApiError;
}
