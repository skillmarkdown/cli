import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseApiResponse,
  type ApiErrorPayload,
} from "../shared/api-client";
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
    typeof record.ownerLogin === "string" &&
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
  request: { ownerSlug: string; skillSlug: string },
  options: ViewClientOptions = {},
): Promise<ViewResponse> {
  const url = new URL(`${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}`);
  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers: authHeaders(options.idToken) },
    { timeoutMs: options.timeoutMs },
  );
  return parseApiResponse(response, {
    label: "View API",
    isValid: isViewResponse,
    missingFieldsMessage: "View API response was missing required fields",
    toApiError: toViewApiError,
  });
}
