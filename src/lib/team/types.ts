export type TeamRole = "owner" | "admin" | "member";
export type MutableTeamRole = Exclude<TeamRole, "owner">;

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
  role: MutableTeamRole;
}

export interface TeamMemberUpdateRequest {
  role: MutableTeamRole;
}

export interface TeamMemberMutationResponse {
  team: string;
  owner: string;
  ownerLogin: string;
  role: TeamRole;
  status: "added" | "updated" | "removed";
}

export type TeamAction =
  | "create"
  | "view"
  | "members_ls"
  | "members_add"
  | "members_set_role"
  | "members_rm";

export interface ParsedTeamFlags {
  valid: boolean;
  json: boolean;
  action?: TeamAction;
  team?: string;
  displayName?: string | null;
  ownerLogin?: string;
  role?: TeamRole;
}
