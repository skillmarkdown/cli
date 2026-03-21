export type SearchScope = "public" | "private";
export type SearchMatch = "all" | "id";

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
  username: string;
  skill: string;
  description: string;
  distTags: Record<string, string>;
  updatedAt: string;
}

export interface SearchSkillsRequest {
  query?: string;
  limit?: number;
  cursor?: string;
  scope?: SearchScope;
  match?: SearchMatch;
}

export interface SearchSkillsResponse {
  query: string | null;
  limit: number;
  results: SearchSkillResult[];
  nextCursor: string | null;
}
