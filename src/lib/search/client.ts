import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseJsonOrThrow,
  type ApiErrorPayload,
} from "../shared/api-client";
import { SearchApiError } from "./errors";
import { type SearchSkillsRequest, type SearchSkillsResponse } from "./types";

interface SearchClientOptions {
  timeoutMs?: number;
  idToken?: string;
}

function toSearchApiError(status: number, payload: ApiErrorPayload): SearchApiError {
  const parsed = extractApiErrorFields(status, payload, `search API request failed (${status})`);
  return new SearchApiError(status, parsed.code, parsed.message, parsed.details);
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

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const mapped: Record<string, string> = {};
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof candidate === "string") {
      mapped[key] = candidate;
    }
  }
  return mapped;
}

function normalizeSearchSkillsResponse(value: SearchSkillsResponse): SearchSkillsResponse {
  const normalizedResults = value.results.map((result) => {
    if (!result || typeof result !== "object") {
      return result;
    }

    const distTags = normalizeStringMap((result as { distTags?: unknown }).distTags);

    return {
      ...result,
      distTags,
    };
  });

  return {
    ...value,
    results: normalizedResults,
  };
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

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: authHeaders(options.idToken),
    },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<SearchSkillsResponse | ApiErrorPayload>(
    response,
    "Search API",
  );

  if (!response.ok) {
    throw toSearchApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isSearchSkillsResponse(parsed)) {
    throw new Error("Search API response was missing required fields");
  }

  return normalizeSearchSkillsResponse(parsed);
}
