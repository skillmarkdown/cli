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

export async function parseJsonOrThrow<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned non-JSON response (${response.status})`);
  }
}

export function extractApiErrorFields(
  status: number,
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
