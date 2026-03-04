export class CliApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(name: string, status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
