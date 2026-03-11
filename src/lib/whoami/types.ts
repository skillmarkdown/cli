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
  organizations?: Array<{
    slug: string;
    owner: string;
    role: "owner" | "admin" | "member";
  }>;
  organizationTeams?: Array<{
    organizationSlug: string;
    teamSlug: string;
  }>;
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
