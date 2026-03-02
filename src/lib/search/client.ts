import { fetchWithTimeout } from "../shared/http";
import { SearchApiError } from "./errors";
import { type SearchSkillsRequest, type SearchSkillsResponse } from "./types";

interface SearchClientOptions {
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
    throw new Error(`Search API returned non-JSON response (${response.status})`);
  }
}

function toSearchApiError(status: number, payload: ApiErrorPayload): SearchApiError {
  const nested = payload.error;
  const code = nested?.code || payload.code || "unknown_error";
  const message = nested?.message || payload.message || `search API request failed (${status})`;
  return new SearchApiError(status, code, message, nested?.details ?? payload.details);
}

function isSearchSkillsResponse(value: unknown): value is SearchSkillsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.limit === "number" &&
    (typeof record.query === "string" || record.query === null) &&
    Array.isArray(record.results) &&
    (typeof record.nextCursor === "string" || record.nextCursor === null)
  );
}

export async function searchSkills(
  baseUrl: string,
  request: SearchSkillsRequest,
  options: SearchClientOptions = {},
): Promise<SearchSkillsResponse> {
  const url = new URL(`${baseUrl}/v1/skills/search`);
  if (request.query) {
    url.searchParams.set("q", request.query);
  }
  if (request.limit) {
    url.searchParams.set("limit", String(request.limit));
  }
  if (request.cursor) {
    url.searchParams.set("cursor", request.cursor);
  }
  if (request.scope) {
    url.searchParams.set("scope", request.scope);
  }

  const headers: HeadersInit | undefined = options.idToken
    ? {
        Authorization: `Bearer ${options.idToken}`,
      }
    : undefined;

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers,
    },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<SearchSkillsResponse | ApiErrorPayload>(response);

  if (!response.ok) {
    throw toSearchApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isSearchSkillsResponse(parsed)) {
    throw new Error("Search API response was missing required fields");
  }

  return parsed;
}
