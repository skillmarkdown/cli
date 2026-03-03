import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseJsonOrThrow,
  type ApiErrorPayload,
} from "../shared/api-client";

interface BootstrapOwnerResponse {
  status: "bootstrapped";
  uid: string;
  owner: string;
  ownerLogin: string;
}

interface BootstrapOwnerOptions {
  timeoutMs?: number;
}

function isBootstrapOwnerResponse(value: unknown): value is BootstrapOwnerResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.status === "bootstrapped" &&
    typeof record.uid === "string" &&
    typeof record.owner === "string" &&
    typeof record.ownerLogin === "string"
  );
}

export async function bootstrapOwner(
  baseUrl: string,
  idToken: string,
  request: { ownerLogin: string },
  options: BootstrapOwnerOptions = {},
): Promise<BootstrapOwnerResponse> {
  const url = new URL(`${baseUrl}/v1/auth/bootstrap-owner`);
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
  const parsed = await parseJsonOrThrow<BootstrapOwnerResponse | ApiErrorPayload>(
    response,
    "Auth bootstrap API",
  );
  if (!response.ok) {
    const error = extractApiErrorFields(
      response.status,
      parsed as ApiErrorPayload,
      `bootstrap-owner request failed (${response.status})`,
    );
    throw new Error(`${error.message} (${error.code}, status ${response.status})`);
  }
  if (!isBootstrapOwnerResponse(parsed)) {
    throw new Error("Auth bootstrap API response was missing required fields");
  }
  return parsed;
}
