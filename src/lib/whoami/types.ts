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
}

export interface ParsedWhoamiFlags {
  valid: boolean;
  json: boolean;
}
