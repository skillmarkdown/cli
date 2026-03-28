import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { AccountApiError } from "./errors";
import { type AccountDeleteResponse, type AccountSupportResponse } from "./types";

interface AccountClientOptions {
  timeoutMs?: number;
}

function toAccountApiError(status: number, payload: ApiErrorPayload): AccountApiError {
  const parsed = extractApiErrorFields(status, payload, `account API request failed (${status})`);
  return new AccountApiError(status, parsed.code, parsed.message, parsed.details);
}

function isAccountDeleteResponse(value: unknown): value is AccountDeleteResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.status === "pending" &&
    typeof record.deletionId === "string" &&
    typeof record.uid === "string" &&
    typeof record.username === "string"
  );
}

function isAccountSupportResponse(value: unknown): value is AccountSupportResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.status === "received" && typeof record.requestId === "string";
}

export async function deleteAccount(
  baseUrl: string,
  idToken: string,
  options: AccountClientOptions = {},
): Promise<AccountDeleteResponse> {
  return requestJson<AccountDeleteResponse, AccountApiError>({
    url: new URL("/v1/account", baseUrl),
    method: "DELETE",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "delete account",
    isValid: isAccountDeleteResponse,
    missingFieldsMessage: "delete account response missing required fields",
    toApiError: toAccountApiError,
  });
}

export async function createAccountSupportRequest(
  baseUrl: string,
  idToken: string,
  request: { subject: string; message: string },
  options: AccountClientOptions = {},
): Promise<AccountSupportResponse> {
  return requestJson<AccountSupportResponse, AccountApiError>({
    url: new URL("/v1/account/support", baseUrl),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "account support",
    isValid: isAccountSupportResponse,
    missingFieldsMessage: "account support response missing required fields",
    toApiError: toAccountApiError,
  });
}
