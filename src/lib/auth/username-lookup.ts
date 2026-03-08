import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";

export class UsernameLookupApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "UsernameLookupApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface UsernameLookupResponse {
  username: string;
  email: string;
}

interface UsernameLookupOptions {
  timeoutMs?: number;
}

function isUsernameLookupResponse(value: unknown): value is UsernameLookupResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.username === "string" && typeof record.email === "string";
}

function toUsernameLookupApiError(
  status: number,
  payload: ApiErrorPayload,
): UsernameLookupApiError {
  const parsed = extractApiErrorFields(status, payload, `username lookup failed (${status})`);
  return new UsernameLookupApiError(status, parsed.code, parsed.message, parsed.details);
}

export async function resolveUsernameEmail(
  baseUrl: string,
  username: string,
  options: UsernameLookupOptions = {},
): Promise<string> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("username is required");
  }

  const response = await requestJson<UsernameLookupResponse, UsernameLookupApiError>({
    url: new URL(`${baseUrl}/v1/auth/usernames/${encodeURIComponent(normalizedUsername)}`),
    method: "GET",
    timeoutMs: options.timeoutMs,
    label: "Username lookup API",
    isValid: isUsernameLookupResponse,
    missingFieldsMessage: "Username lookup API response was missing required fields",
    toApiError: toUsernameLookupApiError,
  });

  return response.email;
}
