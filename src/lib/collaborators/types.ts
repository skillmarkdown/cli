export interface CollaboratorsEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface SkillCollaborator {
  username: string;
  role: "maintainer";
  addedAt: string;
  avatarUrl: string | null;
  lastPublishedAt: string | null;
}

export interface ListSkillCollaboratorsResponse {
  owner: string;
  username: string;
  skill: string;
  collaborators: SkillCollaborator[];
}

export interface AddSkillCollaboratorResponse {
  owner: string;
  username: string;
  skill: string;
  collaborator: {
    username: string;
    role: "maintainer";
  };
}

export interface RemoveSkillCollaboratorResponse {
  owner: string;
  username: string;
  skill: string;
  collaborator: {
    username: string;
  };
}

export type ParsedCollaboratorsFlags =
  | { valid: true; action: "ls"; skillId: string; json: boolean }
  | { valid: true; action: "add"; skillId: string; username: string; json: boolean }
  | { valid: true; action: "rm"; skillId: string; username: string; json: boolean }
  | { valid: false; json: false };
