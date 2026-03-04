import { CliApiError } from "../shared/api-errors";

export class TagApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("TagApiError", status, code, message, details);
  }
}

export function isTagApiError(error: unknown): error is TagApiError {
  return error instanceof TagApiError;
}
