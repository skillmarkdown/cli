import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { ViewApiError } from "./errors";
import { type ViewResponse } from "./types";

interface ViewClientOptions {
  timeoutMs?: number;
  idToken?: string;
}

function toViewApiError(status: number, payload: ApiErrorPayload): ViewApiError {
  const parsed = extractApiErrorFields(status, payload, `view API request failed (${status})`);
  return new ViewApiError(status, parsed.code, parsed.message, parsed.details);
}

function isViewResponse(value: unknown): value is ViewResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    typeof record.skill === "string" &&
    typeof record.description === "string" &&
    typeof record.access === "string" &&
    !!record.distTags &&
    typeof record.distTags === "object" &&
    typeof record.updatedAt === "string"
  );
}

export async function getSkillView(
  baseUrl: string,
  request: { username: string; skillSlug: string },
  options: ViewClientOptions = {},
): Promise<ViewResponse> {
  const routePath = request.username
    ? `@${request.username}/${request.skillSlug}`
    : request.skillSlug;
  return requestJson({
    url: new URL(`${baseUrl}/v1/skills/${routePath}`),
    method: "GET",
    idToken: options.idToken,
    timeoutMs: options.timeoutMs,
    label: "View API",
    isValid: isViewResponse,
    missingFieldsMessage: "View API response was missing required fields",
    toApiError: toViewApiError,
  });
}
