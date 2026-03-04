import { isUseApiError } from "../use/errors";

export function toUseApiErrorReason(error: unknown): string {
  if (isUseApiError(error)) {
    return `${error.message} (${error.code}, status ${error.status})`;
  }

  return error instanceof Error ? error.message : "Unknown error";
}

export function resolveTableMaxWidth(): number | undefined {
  return process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;
}
