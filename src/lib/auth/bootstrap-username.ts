import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseJsonOrThrow,
  type ApiErrorPayload,
} from "../shared/api-client";

interface BootstrapUsernameResponse {
  status: "bootstrapped";
  uid: string;
  owner: string;
  username: string;
}

interface BootstrapUsernameOptions {
  timeoutMs?: number;
}

function isBootstrapUsernameResponse(value: unknown): value is BootstrapUsernameResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.status === "bootstrapped" &&
    typeof record.uid === "string" &&
    typeof record.owner === "string" &&
    typeof record.username === "string"
  );
}

export async function bootstrapUsername(
  baseUrl: string,
  idToken: string,
  request: { username: string },
  options: BootstrapUsernameOptions = {},
): Promise<BootstrapUsernameResponse> {
  const url = new URL(`${baseUrl}/v1/auth/bootstrap-username`);
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        ...(authHeaders(idToken) ?? {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<BootstrapUsernameResponse | ApiErrorPayload>(
    response,
    "Auth bootstrap API",
  );
  if (!response.ok) {
    const errorPayload =
      parsed && typeof parsed === "object" ? (parsed as ApiErrorPayload) : ({} as ApiErrorPayload);
    const error = extractApiErrorFields(
      response.status,
      errorPayload,
      `bootstrap-username request failed (${response.status})`,
    );
    throw new Error(`${error.message} (${error.code}, status ${response.status})`);
  }
  if (!isBootstrapUsernameResponse(parsed)) {
    throw new Error("Auth bootstrap username API response was missing required fields");
  }
  return parsed;
}
