import { fetchWithTimeout } from "../shared/http";

interface SecureTokenApiResponse {
  id_token?: string;
  user_id?: string;
  expires_in?: string;
  refresh_token?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface FirebaseIdTokenSession {
  idToken: string;
  userId: string;
  expiresInSeconds: number;
}

const FIREBASE_HTTP_TIMEOUT_MS = 10_000;

async function parseJsonApiResponse<T>(response: Response, apiLabel: string): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${apiLabel} returned non-JSON response (${response.status})`);
  }
}

export async function exchangeRefreshTokenForIdToken(
  apiKey: string,
  refreshToken: string,
): Promise<FirebaseIdTokenSession> {
  const response = await fetchWithTimeout(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
    { timeoutMs: FIREBASE_HTTP_TIMEOUT_MS },
  );

  const payload = await parseJsonApiResponse<SecureTokenApiResponse>(
    response,
    "Firebase secure token API",
  );

  if (!response.ok) {
    throw new Error(
      `Firebase secure token exchange failed (${response.status}): ${payload.error?.message || "unknown error"}`,
    );
  }

  if (!payload.id_token || !payload.user_id || !payload.expires_in) {
    throw new Error("Firebase secure token response was missing required fields");
  }

  const expiresInSeconds = Number.parseInt(payload.expires_in, 10);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("Firebase secure token response had invalid expiry");
  }

  return {
    idToken: payload.id_token,
    userId: payload.user_id,
    expiresInSeconds,
  };
}
