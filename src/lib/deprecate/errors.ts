export class DeprecateApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DeprecateApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isDeprecateApiError(error: unknown): error is DeprecateApiError {
  return error instanceof DeprecateApiError;
}
