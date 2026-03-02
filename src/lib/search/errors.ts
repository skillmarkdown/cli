export class SearchApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "SearchApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isSearchApiError(error: unknown): error is SearchApiError {
  return error instanceof SearchApiError;
}
