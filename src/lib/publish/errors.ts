import { CliApiError } from "../shared/api-errors";

export class PublishApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("PublishApiError", status, code, message, details);
  }
}

export function isPublishApiError(error: unknown): error is PublishApiError {
  return error instanceof PublishApiError;
}
