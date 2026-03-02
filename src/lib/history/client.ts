import { fetchWithTimeout } from "../shared/http";
import { HistoryApiError } from "./errors";
import { type HistoryRequest, type HistoryResponse } from "./types";

interface HistoryClientOptions {
  timeoutMs?: number;
  idToken?: string;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  code?: string;
  message?: string;
  details?: unknown;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`History API returned non-JSON response (${response.status})`);
  }
}

function toHistoryApiError(status: number, payload: ApiErrorPayload): HistoryApiError {
  const nested = payload.error;
  const code = nested?.code || payload.code || "unknown_error";
  const message = nested?.message || payload.message || `history API request failed (${status})`;
  return new HistoryApiError(status, code, message, nested?.details ?? payload.details);
}

function isHistoryResponse(value: unknown): value is HistoryResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.ownerLogin === "string" &&
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
  const url = new URL(`${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/versions`);

  if (request.limit) {
    url.searchParams.set("limit", String(request.limit));
  }
  if (request.cursor) {
    url.searchParams.set("cursor", request.cursor);
  }

  const headers: HeadersInit | undefined = options.idToken
    ? {
        Authorization: `Bearer ${options.idToken}`,
      }
    : undefined;

  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<HistoryResponse | ApiErrorPayload>(response);

  if (!response.ok) {
    throw toHistoryApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isHistoryResponse(parsed)) {
    throw new Error("History API response was missing required fields");
  }

  return parsed;
}
