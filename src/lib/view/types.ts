export interface ViewFlags {
  skillId?: string;
  json: boolean;
  valid: boolean;
}

export interface ViewEnvConfig {
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface ViewResponse {
  owner: string;
  username: string;
  skill: string;
  description: string;
  access: string;
  distTags: Record<string, string>;
  updatedAt: string;
}
