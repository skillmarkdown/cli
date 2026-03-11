import { CliApiError } from "../shared/api-errors";

export class OrgApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("OrgApiError", status, code, message, details);
  }
}

export function isOrgApiError(error: unknown): error is OrgApiError {
  return error instanceof OrgApiError;
}
