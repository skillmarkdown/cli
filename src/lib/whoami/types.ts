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
  organizations?: Array<{
    owner: string;
    role: "owner" | "admin" | "member";
    slug: string;
  }>;
}

export interface ParsedWhoamiFlags {
  valid: boolean;
  json: boolean;
}
