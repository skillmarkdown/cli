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

const FIREBASE_HTTP_TIMEOUT_MS = 10_000;

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

  const text = await response.text();
  let payload: FirebaseIdpApiResponse;
  try {
    payload = JSON.parse(text) as FirebaseIdpApiResponse;
  } catch {
    throw new Error(`Firebase auth API returned non-JSON response (${response.status})`);
  }

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
