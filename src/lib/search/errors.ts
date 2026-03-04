import { CliApiError } from "../shared/api-errors";

export class SearchApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("SearchApiError", status, code, message, details);
  }
}

export function isSearchApiError(error: unknown): error is SearchApiError {
  return error instanceof SearchApiError;
}
