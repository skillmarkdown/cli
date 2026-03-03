export interface DeprecateFlags {
  valid: boolean;
  json: boolean;
  skillWithSelector?: string;
  message?: string;
}

export interface ParsedDeprecateRequest {
  skillId: string;
  range: string;
  message: string;
  json: boolean;
}

export interface DeprecateEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface DeprecateVersionsRequest {
  ownerSlug: string;
  skillSlug: string;
  range: string;
  message: string;
}

export interface DeprecateVersionsResponse {
  status: "updated";
  range: string;
  affectedVersions: string[];
  message: string;
}
