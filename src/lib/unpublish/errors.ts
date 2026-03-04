import { CliApiError } from "../shared/api-errors";

export class UnpublishApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("UnpublishApiError", status, code, message, details);
  }
}

export function isUnpublishApiError(error: unknown): error is UnpublishApiError {
  return error instanceof UnpublishApiError;
}
