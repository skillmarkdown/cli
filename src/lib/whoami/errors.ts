export class WhoamiApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "WhoamiApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isWhoamiApiError(error: unknown): error is WhoamiApiError {
  return error instanceof WhoamiApiError;
}
