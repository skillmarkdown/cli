import { CliApiError } from "../shared/api-errors";

export class TeamApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("TeamApiError", status, code, message, details);
  }
}

export function isTeamApiError(error: unknown): error is TeamApiError {
  return error instanceof TeamApiError;
}
