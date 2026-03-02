export type SearchScope = "public" | "private";

export interface SearchFlags {
  query?: string;
  limit?: number;
  cursor?: string;
  scope: SearchScope;
  json: boolean;
  valid: boolean;
}

export interface SearchEnvConfig {
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface SearchSkillResult {
  skillId: string;
  owner: string;
  ownerLogin: string;
  skill: string;
  description: string;
  channels: {
    latest?: string;
    beta?: string;
  };
  updatedAt: string;
}

export interface SearchSkillsRequest {
  query?: string;
  limit?: number;
  cursor?: string;
  scope?: SearchScope;
}

export interface SearchSkillsResponse {
  query: string | null;
  limit: number;
  results: SearchSkillResult[];
  nextCursor: string | null;
}
