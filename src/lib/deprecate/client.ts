import { fetchWithTimeout } from "../shared/http";
import {
  extractApiErrorFields,
  parseJsonOrThrow,
  type ApiErrorPayload,
} from "../shared/api-client";
import { DeprecateApiError } from "./errors";
import { type DeprecateVersionsRequest, type DeprecateVersionsResponse } from "./types";

interface DeprecateClientOptions {
  timeoutMs?: number;
}

function toDeprecateApiError(status: number, payload: ApiErrorPayload): DeprecateApiError {
  const parsed = extractApiErrorFields(status, payload, `deprecate API request failed (${status})`);
  return new DeprecateApiError(status, parsed.code, parsed.message, parsed.details);
}

function isDeprecateVersionsResponse(value: unknown): value is DeprecateVersionsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.status === "updated" &&
    typeof record.range === "string" &&
    Array.isArray(record.affectedVersions) &&
    typeof record.message === "string"
  );
}

export async function deprecateVersions(
  baseUrl: string,
  idToken: string,
  request: DeprecateVersionsRequest,
  options: DeprecateClientOptions = {},
): Promise<DeprecateVersionsResponse> {
  const url = new URL(
    `${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/deprecations`,
  );
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: request.range,
        message: request.message,
      }),
    },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<DeprecateVersionsResponse | ApiErrorPayload>(
    response,
    "Deprecate API",
  );

  if (!response.ok) {
    throw toDeprecateApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isDeprecateVersionsResponse(parsed)) {
    throw new Error("Deprecate API response was missing required fields");
  }

  return parsed;
}
