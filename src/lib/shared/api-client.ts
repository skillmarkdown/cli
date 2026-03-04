import { fetchWithTimeout } from "./http";

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  code?: string;
  message?: string;
  details?: unknown;
}

export interface ApiErrorFields {
  code: string;
  message: string;
  details?: unknown;
}

interface ParseApiResponseOptions<TSuccess, TApiError extends Error> {
  label: string;
  isValid: (value: unknown) => value is TSuccess;
  missingFieldsMessage: string;
  toApiError: (status: number, payload: ApiErrorPayload) => TApiError;
}

interface RequestJsonOptions<TSuccess, TApiError extends Error> extends ParseApiResponseOptions<
  TSuccess,
  TApiError
> {
  url: URL | string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  timeoutMs?: number;
  idToken?: string;
  body?: unknown;
}

export async function parseJsonOrThrow<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned non-JSON response (${response.status})`);
  }
}

export function extractApiErrorFields(
  _status: number,
  payload: ApiErrorPayload,
  fallbackMessage: string,
): ApiErrorFields {
  const nested = payload.error;
  return {
    code: nested?.code || payload.code || "unknown_error",
    message: nested?.message || payload.message || fallbackMessage,
    details: nested?.details ?? payload.details,
  };
}

export function authHeaders(idToken?: string): HeadersInit | undefined {
  if (!idToken) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${idToken}`,
  };
}

export async function parseApiResponse<TSuccess, TApiError extends Error>(
  response: Response,
  options: ParseApiResponseOptions<TSuccess, TApiError>,
): Promise<TSuccess> {
  const parsed = await parseJsonOrThrow<TSuccess | ApiErrorPayload>(response, options.label);

  if (!response.ok) {
    throw options.toApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!options.isValid(parsed)) {
    throw new Error(options.missingFieldsMessage);
  }

  return parsed;
}

export async function requestJson<TSuccess, TApiError extends Error>(
  options: RequestJsonOptions<TSuccess, TApiError>,
): Promise<TSuccess> {
  const headers = {
    ...(authHeaders(options.idToken) ?? {}),
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  const response = await fetchWithTimeout(
    options.url,
    {
      method: options.method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    },
    { timeoutMs: options.timeoutMs },
  );
  return parseApiResponse(response, options);
}
