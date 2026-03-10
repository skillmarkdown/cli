import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { WhoamiApiError } from "./errors";
import { type WhoamiResponse } from "./types";

interface WhoamiClientOptions {
  timeoutMs?: number;
}

function toWhoamiApiError(status: number, payload: ApiErrorPayload): WhoamiApiError {
  const parsed = extractApiErrorFields(status, payload, `whoami request failed (${status})`);
  return new WhoamiApiError(status, parsed.code, parsed.message, parsed.details);
}

function isWhoamiResponse(value: unknown): value is WhoamiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const entitlementsValid =
    record.entitlements === undefined ||
    (record.entitlements !== null &&
      typeof record.entitlements === "object" &&
      !Array.isArray(record.entitlements));
  const planValid = record.plan === undefined || record.plan === "free" || record.plan === "pro";

  return (
    typeof record.uid === "string" &&
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    (typeof record.email === "string" || record.email === null) &&
    (typeof record.projectId === "string" || record.projectId === null) &&
    (record.authType === "firebase" || record.authType === "token") &&
    (record.scope === "read" || record.scope === "publish" || record.scope === "admin") &&
    planValid &&
    entitlementsValid
  );
}

export async function getWhoami(
  baseUrl: string,
  idToken: string,
  options: WhoamiClientOptions = {},
): Promise<WhoamiResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/auth/whoami`),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Whoami API",
    isValid: isWhoamiResponse,
    missingFieldsMessage: "Whoami API response was missing required fields",
    toApiError: toWhoamiApiError,
  });
}
