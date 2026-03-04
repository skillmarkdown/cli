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
