import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { HistoryApiError } from "./errors";
import { type HistoryRequest, type HistoryResponse } from "./types";

interface HistoryClientOptions {
  timeoutMs?: number;
  idToken?: string;
}

function toHistoryApiError(status: number, payload: ApiErrorPayload): HistoryApiError {
  const parsed = extractApiErrorFields(status, payload, `history API request failed (${status})`);
  return new HistoryApiError(status, parsed.code, parsed.message, parsed.details);
}

function isHistoryResponse(value: unknown): value is HistoryResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    typeof record.skill === "string" &&
    typeof record.limit === "number" &&
    Array.isArray(record.results) &&
    (typeof record.nextCursor === "string" || record.nextCursor === null)
  );
}

export async function listSkillVersionHistory(
  baseUrl: string,
  request: HistoryRequest,
  options: HistoryClientOptions = {},
): Promise<HistoryResponse> {
  const routePath = request.username
    ? `@${request.username}/${request.skillSlug}`
    : request.skillSlug;
  const url = new URL(`${baseUrl}/v1/skills/${routePath}/versions`);

  if (request.limit) {
    url.searchParams.set("limit", String(request.limit));
  }
  if (request.cursor) {
    url.searchParams.set("cursor", request.cursor);
  }

  return requestJson({
    url,
    method: "GET",
    idToken: options.idToken,
    timeoutMs: options.timeoutMs,
    label: "History API",
    isValid: isHistoryResponse,
    missingFieldsMessage: "History API response was missing required fields",
    toApiError: toHistoryApiError,
  });
}
