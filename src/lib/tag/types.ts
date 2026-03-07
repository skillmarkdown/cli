export type TagCommandAction = "ls" | "add" | "rm";

export type ParsedTagFlags =
  | {
      valid: true;
      action: "ls";
      skillId: string;
      json: boolean;
    }
  | {
      valid: true;
      action: "add";
      skillId: string;
      version: string;
      tag: string;
      json: boolean;
    }
  | {
      valid: true;
      action: "rm";
      skillId: string;
      tag: string;
      json: boolean;
    }
  | {
      valid: false;
      json: false;
    };

export interface TagEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface DistTagsListResponse {
  owner: string;
  username: string;
  skill: string;
  distTags: Record<string, string>;
  updatedAt: string;
}

export interface SetDistTagRequest {
  username: string;
  skillSlug: string;
  tag: string;
  version: string;
}

export interface DistTagUpdateResponse {
  status: "updated";
  tag: string;
  version: string;
  distTags: Record<string, string>;
}

export interface DeleteDistTagRequest {
  username: string;
  skillSlug: string;
  tag: string;
}

export interface DistTagDeleteResponse {
  status: "deleted";
  tag: string;
  distTags: Record<string, string>;
}
