import { CliApiError } from "../shared/api-errors";

export class CollaboratorsApiError extends CliApiError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super("CollaboratorsApiError", status, code, message, details);
  }
}

export function isCollaboratorsApiError(error: unknown): error is CollaboratorsApiError {
  return error instanceof CollaboratorsApiError;
}
