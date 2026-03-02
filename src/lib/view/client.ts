import { fetchWithTimeout } from "../shared/http";
import { ViewApiError } from "./errors";
import { type ViewResponse } from "./types";

interface ViewClientOptions {
  timeoutMs?: number;
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
    throw new Error(`View API returned non-JSON response (${response.status})`);
  }
}

function toViewApiError(status: number, payload: ApiErrorPayload): ViewApiError {
  const nested = payload.error;
  const code = nested?.code || payload.code || "unknown_error";
  const message = nested?.message || payload.message || `view API request failed (${status})`;
  return new ViewApiError(status, code, message, nested?.details ?? payload.details);
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
    typeof record.visibility === "string" &&
    !!record.channels &&
    typeof record.channels === "object" &&
    typeof record.updatedAt === "string"
  );
}

export async function getSkillView(
  baseUrl: string,
  request: { ownerSlug: string; skillSlug: string },
  options: ViewClientOptions = {},
): Promise<ViewResponse> {
  const url = new URL(`${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}`);
  const response = await fetchWithTimeout(url, { method: "GET" }, { timeoutMs: options.timeoutMs });
  const parsed = await parseJsonOrThrow<ViewResponse | ApiErrorPayload>(response);

  if (!response.ok) {
    throw toViewApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isViewResponse(parsed)) {
    throw new Error("View API response was missing required fields");
  }

  return parsed;
}
