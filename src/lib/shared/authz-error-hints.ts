import { CliApiError } from "./api-errors";

function detailsRecord(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }
  return details as Record<string, unknown>;
}

export function authzHintForReason(reason?: string): string | null {
  if (reason === "forbidden_scope") {
    return "Hint: use a token with the required scope or run 'skillmd login' again.";
  }
  if (
    reason === "forbidden_owner" ||
    reason === "forbidden_role" ||
    reason === "forbidden_membership"
  ) {
    return "Hint: verify your owner identity with 'skillmd whoami' and inspect org access with 'skillmd org ...'.";
  }
  if (reason === "forbidden_plan") {
    return "Hint: private skills require a Pro plan. Free users can only use public skills.";
  }
  return null;
}

export function extractCliApiErrorReason(error: CliApiError): string | undefined {
  const details = detailsRecord(error.details);
  const reason = details?.reason;
  return typeof reason === "string" && reason.trim() ? reason : undefined;
}

export function extractCliApiErrorRequestId(error: CliApiError): string | null {
  const details = detailsRecord(error.details);
  const requestId = details?.requestId;
  return typeof requestId === "string" && requestId.trim() ? requestId : null;
}

export function formatCliApiErrorMessage(prefix: string, error: CliApiError): string {
  const requestId = extractCliApiErrorRequestId(error);
  const requestSuffix = requestId ? `, request ${requestId}` : "";
  return `${prefix}: ${error.message} (${error.code}, status ${error.status}${requestSuffix})`;
}

export function formatCliApiErrorWithHint(prefix: string, error: CliApiError): string {
  const base = formatCliApiErrorMessage(prefix, error);
  const hint = authzHintForReason(extractCliApiErrorReason(error));
  return hint ? `${base}\n${hint}` : base;
}

export function getCliApiErrorHint(error: CliApiError): string | null {
  return authzHintForReason(extractCliApiErrorReason(error));
}
