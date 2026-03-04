export interface WhoamiEnvConfig {
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface WhoamiResponse {
  uid: string;
  owner: string;
  ownerLogin: string;
  email: string | null;
  projectId: string | null;
  authType: "firebase" | "token";
  scope: "read" | "publish" | "admin";
  plan?: "free" | "pro" | "teams";
  entitlements?: Record<string, boolean | number | string | null>;
  teams?: Array<{
    team: string;
    role: "owner" | "admin" | "member";
  }>;
}

export interface ParsedWhoamiFlags {
  valid: boolean;
  json: boolean;
}
