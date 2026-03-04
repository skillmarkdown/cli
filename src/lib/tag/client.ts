import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseApiResponse,
  type ApiErrorPayload,
} from "../shared/api-client";
import { TagApiError } from "./errors";
import {
  type DeleteDistTagRequest,
  type DistTagDeleteResponse,
  type DistTagsListResponse,
  type DistTagUpdateResponse,
  type SetDistTagRequest,
} from "./types";

interface TagClientOptions {
  timeoutMs?: number;
  idToken?: string;
}

function toTagApiError(status: number, payload: ApiErrorPayload): TagApiError {
  const parsed = extractApiErrorFields(status, payload, `tag API request failed (${status})`);
  return new TagApiError(status, parsed.code, parsed.message, parsed.details);
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof candidate === "string") {
      normalized[key] = candidate;
    }
  }
  return normalized;
}

function isDistTagsListResponse(value: unknown): value is DistTagsListResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.ownerLogin === "string" &&
    typeof record.skill === "string" &&
    !!record.distTags &&
    typeof record.distTags === "object" &&
    typeof record.updatedAt === "string"
  );
}

function isDistTagUpdateResponse(value: unknown): value is DistTagUpdateResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.status === "updated" &&
    typeof record.tag === "string" &&
    typeof record.version === "string" &&
    !!record.distTags &&
    typeof record.distTags === "object"
  );
}

function isDistTagDeleteResponse(value: unknown): value is DistTagDeleteResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.status === "deleted" &&
    typeof record.tag === "string" &&
    !!record.distTags &&
    typeof record.distTags === "object"
  );
}

export async function listDistTags(
  baseUrl: string,
  request: { ownerSlug: string; skillSlug: string },
  options: TagClientOptions = {},
): Promise<DistTagsListResponse> {
  const url = new URL(`${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/dist-tags`);
  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers: authHeaders(options.idToken) },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseApiResponse(response, {
    label: "Tag API",
    isValid: isDistTagsListResponse,
    missingFieldsMessage: "Tag API response was missing required fields",
    toApiError: toTagApiError,
  });

  return {
    ...parsed,
    distTags: normalizeStringMap(parsed.distTags),
  };
}

export async function setDistTag(
  baseUrl: string,
  idToken: string,
  request: SetDistTagRequest,
  options: TagClientOptions = {},
): Promise<DistTagUpdateResponse> {
  const url = new URL(
    `${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/dist-tags/${request.tag}`,
  );
  const response = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: request.version,
      }),
    },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseApiResponse(response, {
    label: "Tag API",
    isValid: isDistTagUpdateResponse,
    missingFieldsMessage: "Tag API response was missing required fields",
    toApiError: toTagApiError,
  });

  return {
    ...parsed,
    distTags: normalizeStringMap(parsed.distTags),
  };
}

export async function removeDistTag(
  baseUrl: string,
  idToken: string,
  request: DeleteDistTagRequest,
  options: TagClientOptions = {},
): Promise<DistTagDeleteResponse> {
  const url = new URL(
    `${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/dist-tags/${request.tag}`,
  );
  const response = await fetchWithTimeout(
    url,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseApiResponse(response, {
    label: "Tag API",
    isValid: isDistTagDeleteResponse,
    missingFieldsMessage: "Tag API response was missing required fields",
    toApiError: toTagApiError,
  });

  return {
    ...parsed,
    distTags: normalizeStringMap(parsed.distTags),
  };
}
