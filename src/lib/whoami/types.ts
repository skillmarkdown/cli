export interface WhoamiEnvConfig {
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface WhoamiResponse {
  uid: string;
  owner: string;
  username: string;
  email: string | null;
  projectId: string | null;
  authType: "firebase" | "token";
  scope: "read" | "publish" | "admin";
  plan?: "free" | "pro";
  entitlements?: Record<string, boolean | number | string | null>;
}

export interface ParsedWhoamiFlags {
  valid: boolean;
  json: boolean;
}
