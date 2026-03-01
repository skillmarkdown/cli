export class PublishApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "PublishApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isPublishApiError(error: unknown): error is PublishApiError {
  return error instanceof PublishApiError;
}
