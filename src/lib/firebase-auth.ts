import { fetchWithTimeout } from "./http";

export interface FirebaseIdpResult {
  localId: string;
  email?: string;
  refreshToken: string;
}

interface FirebaseIdpApiResponse {
  localId?: string;
  email?: string;
  refreshToken?: string;
  error?: {
    message?: string;
  };
}

export interface FirebaseRefreshTokenValidationResult {
  valid: boolean;
}

interface FirebaseRefreshTokenApiResponse {
  refresh_token?: string;
  access_token?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
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

export async function signInWithGitHubAccessToken(
  apiKey: string,
  githubAccessToken: string,
): Promise<FirebaseIdpResult> {
  const response = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestUri: "http://localhost",
        returnSecureToken: true,
        returnIdpCredential: true,
        postBody: `access_token=${encodeURIComponent(githubAccessToken)}&providerId=github.com`,
      }),
    },
    { timeoutMs: FIREBASE_HTTP_TIMEOUT_MS },
  );

  const payload = await parseJsonApiResponse<FirebaseIdpApiResponse>(response, "Firebase auth API");

  if (!response.ok) {
    const message = payload.error?.message || "Firebase signInWithIdp request failed";
    throw new Error(`Firebase auth error: ${message}`);
  }

  if (!payload.localId || !payload.refreshToken) {
    throw new Error("Firebase auth response was missing required fields");
  }

  return {
    localId: payload.localId,
    email: payload.email,
    refreshToken: payload.refreshToken,
  };
}

export async function verifyFirebaseRefreshToken(
  apiKey: string,
  refreshToken: string,
): Promise<FirebaseRefreshTokenValidationResult> {
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

  const payload = await parseJsonApiResponse<FirebaseRefreshTokenApiResponse>(
    response,
    "Firebase token API",
  );

  if (response.ok) {
    if (!payload.refresh_token || !payload.access_token) {
      throw new Error("Firebase token API response was missing required fields");
    }

    return { valid: true };
  }

  const errorMessage = payload.error?.message ?? "";
  if (
    response.status === 400 &&
    (errorMessage === "INVALID_REFRESH_TOKEN" || errorMessage === "TOKEN_EXPIRED")
  ) {
    return { valid: false };
  }

  throw new Error(
    `Firebase token verification failed (${response.status}): ${errorMessage || "unknown error"}`,
  );
}
