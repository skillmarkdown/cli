export interface HistoryFlags {
  skillId?: string;
  limit?: number;
  cursor?: string;
  json: boolean;
  valid: boolean;
}

export interface HistoryEnvConfig {
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface HistoryVersionResult {
  version: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  publishedAt: string;
  deprecated: boolean;
  deprecatedAt: string | null;
  deprecatedMessage: string | null;
}

export interface HistoryRequest {
  username: string;
  skillSlug: string;
  limit?: number;
  cursor?: string;
}

export interface HistoryResponse {
  owner: string;
  username: string;
  skill: string;
  limit: number;
  results: HistoryVersionResult[];
  nextCursor: string | null;
}
