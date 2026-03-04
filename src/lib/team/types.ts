export type TeamRole = "owner" | "admin" | "member";

export interface TeamEnvConfig {
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface TeamRecord {
  team: string;
  displayName: string;
  createdAt: string;
  updatedAt?: string;
  role: TeamRole;
}

export interface TeamMemberRecord {
  owner: string;
  ownerLogin: string;
  role: TeamRole;
  addedAt: string;
  updatedAt: string;
}

export interface TeamMembersResponse {
  team: string;
  members: TeamMemberRecord[];
}

export interface TeamCreateRequest {
  team: string;
  displayName: string;
}

export interface TeamMemberAddRequest {
  ownerLogin: string;
  role: Exclude<TeamRole, "owner">;
}

export interface TeamMemberUpdateRequest {
  role: Exclude<TeamRole, "owner">;
}

export interface TeamMemberMutationResponse {
  team: string;
  owner: string;
  ownerLogin: string;
  role: TeamRole;
  status: "added" | "updated" | "removed";
}

export type ParsedTeamFlags =
  | {
      valid: true;
      action: "create";
      team: string;
      displayName: string | null;
      json: boolean;
    }
  | {
      valid: true;
      action: "view";
      team: string;
      json: boolean;
    }
  | {
      valid: true;
      action: "members_ls";
      team: string;
      json: boolean;
    }
  | {
      valid: true;
      action: "members_add";
      team: string;
      ownerLogin: string;
      role: Exclude<TeamRole, "owner">;
      json: boolean;
    }
  | {
      valid: true;
      action: "members_set_role";
      team: string;
      ownerLogin: string;
      role: Exclude<TeamRole, "owner">;
      json: boolean;
    }
  | {
      valid: true;
      action: "members_rm";
      team: string;
      ownerLogin: string;
      json: boolean;
    }
  | {
      valid: false;
      json: false;
    };
