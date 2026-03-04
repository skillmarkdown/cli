export class TokenApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "TokenApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isTokenApiError(error: unknown): error is TokenApiError {
  return error instanceof TokenApiError;
}
