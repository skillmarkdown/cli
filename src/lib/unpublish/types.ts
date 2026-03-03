export interface UnpublishFlags {
  valid: boolean;
  json: boolean;
  skillWithVersion?: string;
}

export interface ParsedUnpublishRequest {
  skillId: string;
  version: string;
  json: boolean;
}

export interface UnpublishEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface UnpublishVersionRequest {
  ownerSlug: string;
  skillSlug: string;
  version: string;
}

export interface UnpublishVersionResponse {
  status: "unpublished";
  version: string;
  tombstoned: boolean;
  removedTags: string[];
  distTags: Record<string, string>;
}
