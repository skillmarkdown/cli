import { CliApiError } from "../shared/api-errors";

export class ReportApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("ReportApiError", status, code, message, details);
  }
}

export function isReportApiError(error: unknown): error is ReportApiError {
  return error instanceof ReportApiError;
}
