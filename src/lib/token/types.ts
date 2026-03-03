export type TokenScope = "read" | "publish" | "admin";

export interface TokenEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export type ParsedTokenFlags =
  | {
      valid: true;
      action: "ls";
      json: boolean;
    }
  | {
      valid: true;
      action: "add";
      name: string;
      scope: TokenScope;
      days: number;
      json: boolean;
    }
  | {
      valid: true;
      action: "rm";
      tokenId: string;
      json: boolean;
    }
  | {
      valid: false;
      json: false;
    };

export interface CreatedTokenResponse {
  tokenId: string;
  token: string;
  name: string;
  scope: TokenScope;
  createdAt: string;
  expiresAt: string;
}

export interface ListedToken {
  tokenId: string;
  name: string;
  scope: TokenScope;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface ListTokensResponse {
  tokens: ListedToken[];
}

export interface RevokeTokenResponse {
  status: "revoked";
  tokenId: string;
}
