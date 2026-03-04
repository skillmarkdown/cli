import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { UnpublishApiError } from "./errors";
import { type UnpublishVersionRequest, type UnpublishVersionResponse } from "./types";

interface UnpublishClientOptions {
  timeoutMs?: number;
}

function toUnpublishApiError(status: number, payload: ApiErrorPayload): UnpublishApiError {
  const parsed = extractApiErrorFields(status, payload, `unpublish API request failed (${status})`);
  return new UnpublishApiError(status, parsed.code, parsed.message, parsed.details);
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

function isUnpublishVersionResponse(value: unknown): value is UnpublishVersionResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.status === "unpublished" &&
    typeof record.version === "string" &&
    typeof record.tombstoned === "boolean" &&
    Array.isArray(record.removedTags) &&
    !!record.distTags &&
    typeof record.distTags === "object"
  );
}

export async function unpublishVersion(
  baseUrl: string,
  idToken: string,
  request: UnpublishVersionRequest,
  options: UnpublishClientOptions = {},
): Promise<UnpublishVersionResponse> {
  const parsed = await requestJson({
    url: new URL(
      `${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/versions/${request.version}`,
    ),
    method: "DELETE",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Unpublish API",
    isValid: isUnpublishVersionResponse,
    missingFieldsMessage: "Unpublish API response was missing required fields",
    toApiError: toUnpublishApiError,
  });

  return {
    ...parsed,
    distTags: normalizeStringMap(parsed.distTags),
  };
}
