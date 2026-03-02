export class ViewApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ViewApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isViewApiError(error: unknown): error is ViewApiError {
  return error instanceof ViewApiError;
}
