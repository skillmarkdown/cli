export interface AccountEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface AccountDeleteResponse {
  status: "pending";
  deletionId: string;
  uid: string;
  username: string;
}

export interface AccountSupportResponse {
  requestId: string;
  status: "received";
}

export type ParsedAccountFlags =
  | { valid: true; action: "delete"; confirm?: string; json: boolean }
  | { valid: true; action: "support"; subject: string; message: string; json: boolean }
  | { valid: false; json: false };
