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
  yanked: boolean;
  yankedAt: string | null;
  yankedReason: string | null;
}

export interface HistoryRequest {
  ownerSlug: string;
  skillSlug: string;
  limit?: number;
  cursor?: string;
}

export interface HistoryResponse {
  owner: string;
  ownerLogin: string;
  skill: string;
  limit: number;
  results: HistoryVersionResult[];
  nextCursor: string | null;
}
