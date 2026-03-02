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
  ownerLogin: string;
  skill: string;
  description: string;
  visibility: string;
  channels: {
    latest?: string;
    beta?: string;
  };
  updatedAt: string;
}
