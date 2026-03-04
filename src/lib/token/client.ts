import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseJsonOrThrow,
  type ApiErrorPayload,
} from "../shared/api-client";
import { TokenApiError } from "./errors";
import {
  type CreatedTokenResponse,
  type ListTokensResponse,
  type RevokeTokenResponse,
  type TokenScope,
} from "./types";

interface TokenClientOptions {
  timeoutMs?: number;
}

function toTokenApiError(status: number, payload: ApiErrorPayload): TokenApiError {
  const parsed = extractApiErrorFields(status, payload, `token API request failed (${status})`);
  return new TokenApiError(status, parsed.code, parsed.message, parsed.details);
}

function isScope(value: unknown): value is TokenScope {
  return value === "read" || value === "publish" || value === "admin";
}

function isCreatedTokenResponse(value: unknown): value is CreatedTokenResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.tokenId === "string" &&
    typeof record.token === "string" &&
    typeof record.name === "string" &&
    isScope(record.scope) &&
    typeof record.createdAt === "string" &&
    typeof record.expiresAt === "string"
  );
}

function isListTokensResponse(value: unknown): value is ListTokensResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.tokens)) {
    return false;
  }
  return record.tokens.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const token = entry as Record<string, unknown>;
    return (
      typeof token.tokenId === "string" &&
      typeof token.name === "string" &&
      isScope(token.scope) &&
      typeof token.createdAt === "string" &&
      typeof token.expiresAt === "string" &&
      (token.revokedAt === undefined ||
        token.revokedAt === null ||
        typeof token.revokedAt === "string") &&
      (token.lastUsedAt === undefined ||
        token.lastUsedAt === null ||
        typeof token.lastUsedAt === "string")
    );
  });
}

function isRevokeTokenResponse(value: unknown): value is RevokeTokenResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.status === "revoked" && typeof record.tokenId === "string";
}

export async function createToken(
  baseUrl: string,
  idToken: string,
  request: { name: string; scope?: TokenScope; expiresDays?: number },
  options: TokenClientOptions = {},
): Promise<CreatedTokenResponse> {
  const url = new URL(`${baseUrl}/v1/auth/tokens`);
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

  const parsed = await parseJsonOrThrow<CreatedTokenResponse | ApiErrorPayload>(
    response,
    "Token API",
  );
  if (!response.ok) {
    throw toTokenApiError(response.status, parsed as ApiErrorPayload);
  }
  if (!isCreatedTokenResponse(parsed)) {
    throw new Error("Token API response was missing required fields");
  }
  return parsed;
}

export async function listTokens(
  baseUrl: string,
  idToken: string,
  options: TokenClientOptions = {},
): Promise<ListTokensResponse> {
  const url = new URL(`${baseUrl}/v1/auth/tokens`);
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: authHeaders(idToken),
    },
    { timeoutMs: options.timeoutMs },
  );

  const parsed = await parseJsonOrThrow<ListTokensResponse | ApiErrorPayload>(
    response,
    "Token API",
  );
  if (!response.ok) {
    throw toTokenApiError(response.status, parsed as ApiErrorPayload);
  }
  if (!isListTokensResponse(parsed)) {
    throw new Error("Token API response was missing required fields");
  }
  return parsed;
}

export async function revokeToken(
  baseUrl: string,
  idToken: string,
  tokenId: string,
  options: TokenClientOptions = {},
): Promise<RevokeTokenResponse> {
  const url = new URL(`${baseUrl}/v1/auth/tokens/${tokenId}`);
  const response = await fetchWithTimeout(
    url,
    {
      method: "DELETE",
      headers: authHeaders(idToken),
    },
    { timeoutMs: options.timeoutMs },
  );

  const parsed = await parseJsonOrThrow<RevokeTokenResponse | ApiErrorPayload>(
    response,
    "Token API",
  );
  if (!response.ok) {
    throw toTokenApiError(response.status, parsed as ApiErrorPayload);
  }
  if (!isRevokeTokenResponse(parsed)) {
    throw new Error("Token API response was missing required fields");
  }
  return parsed;
}
