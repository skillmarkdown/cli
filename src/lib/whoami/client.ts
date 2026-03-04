import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseApiResponse,
  type ApiErrorPayload,
} from "../shared/api-client";
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
  const teamsValid =
    record.teams === undefined ||
    (Array.isArray(record.teams) &&
      record.teams.every((entry) => {
        if (!entry || typeof entry !== "object") {
          return false;
        }
        const team = entry as Record<string, unknown>;
        return (
          typeof team.team === "string" &&
          (team.role === "owner" || team.role === "admin" || team.role === "member")
        );
      }));
  const entitlementsValid =
    record.entitlements === undefined ||
    (record.entitlements !== null &&
      typeof record.entitlements === "object" &&
      !Array.isArray(record.entitlements));
  const planValid =
    record.plan === undefined ||
    record.plan === "free" ||
    record.plan === "pro" ||
    record.plan === "teams";

  return (
    typeof record.uid === "string" &&
    typeof record.owner === "string" &&
    typeof record.ownerLogin === "string" &&
    (typeof record.email === "string" || record.email === null) &&
    (typeof record.projectId === "string" || record.projectId === null) &&
    (record.authType === "firebase" || record.authType === "token") &&
    (record.scope === "read" || record.scope === "publish" || record.scope === "admin") &&
    planValid &&
    entitlementsValid &&
    teamsValid
  );
}

export async function getWhoami(
  baseUrl: string,
  idToken: string,
  options: WhoamiClientOptions = {},
): Promise<WhoamiResponse> {
  const url = new URL(`${baseUrl}/v1/auth/whoami`);
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: authHeaders(idToken),
    },
    { timeoutMs: options.timeoutMs },
  );
  return parseApiResponse(response, {
    label: "Whoami API",
    isValid: isWhoamiResponse,
    missingFieldsMessage: "Whoami API response was missing required fields",
    toApiError: toWhoamiApiError,
  });
}
