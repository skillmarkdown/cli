import { CliApiError } from "../shared/api-errors";

export class WhoamiApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("WhoamiApiError", status, code, message, details);
  }
}

export function isWhoamiApiError(error: unknown): error is WhoamiApiError {
  return error instanceof WhoamiApiError;
}
