import { fetchWithTimeout } from "./http";

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface GitHubAccessTokenResult {
  accessToken: string;
}

interface GitHubDeviceCodeApiResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface GitHubAccessTokenApiResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_HTTP_TIMEOUT_MS = 10_000;

async function postGitHubForm<T>(url: string, form: URLSearchParams): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
    { timeoutMs: GITHUB_HTTP_TIMEOUT_MS },
  );

  const text = await response.text();
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    throw new Error(`GitHub API returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status})`);
  }

  return parsed;
}

export async function requestDeviceCode(
  clientId: string,
  scope = "read:user user:email",
): Promise<DeviceCodeResponse> {
  const payload = await postGitHubForm<GitHubDeviceCodeApiResponse>(
    GITHUB_DEVICE_CODE_URL,
    new URLSearchParams({
      client_id: clientId,
      scope,
    }),
  );

  if (
    !payload.device_code ||
    !payload.user_code ||
    !payload.verification_uri ||
    !payload.expires_in
  ) {
    throw new Error("GitHub device code response was missing required fields");
  }

  return {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    verificationUriComplete: payload.verification_uri_complete,
    expiresIn: payload.expires_in,
    interval: payload.interval ?? 5,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function pollForAccessToken(
  clientId: string,
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
): Promise<GitHubAccessTokenResult> {
  const startedAt = Date.now();
  let pollInterval = Math.max(1, intervalSeconds);

  while (Date.now() - startedAt < expiresInSeconds * 1000) {
    await sleep(pollInterval * 1000);

    const payload = await postGitHubForm<GitHubAccessTokenApiResponse>(
      GITHUB_ACCESS_TOKEN_URL,
      new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    );

    if (payload.access_token) {
      return { accessToken: payload.access_token };
    }

    if (!payload.error || payload.error === "authorization_pending") {
      continue;
    }

    if (payload.error === "slow_down") {
      pollInterval += 5;
      continue;
    }

    if (payload.error === "expired_token") {
      throw new Error("GitHub device code expired before authorization completed");
    }

    if (payload.error === "access_denied") {
      throw new Error("GitHub authorization was denied by the user");
    }

    throw new Error(payload.error_description || `GitHub OAuth error: ${payload.error}`);
  }

  throw new Error("GitHub device login timed out");
}
