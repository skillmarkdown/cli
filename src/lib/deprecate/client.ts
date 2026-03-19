import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { buildSkillRoutePath } from "../shared/skill-route";
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
  const routePath = buildSkillRoutePath(request.username, request.skillSlug);
  return requestJson({
    url: new URL(`${baseUrl}/v1/skills/${routePath}/deprecations`),
    method: "POST",
    idToken,
    body: {
      range: request.range,
      message: request.message,
    },
    timeoutMs: options.timeoutMs,
    label: "Deprecate API",
    isValid: isDeprecateVersionsResponse,
    missingFieldsMessage: "Deprecate API response was missing required fields",
    toApiError: toDeprecateApiError,
  });
}
