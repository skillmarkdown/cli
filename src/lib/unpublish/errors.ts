export class UnpublishApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "UnpublishApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isUnpublishApiError(error: unknown): error is UnpublishApiError {
  return error instanceof UnpublishApiError;
}
