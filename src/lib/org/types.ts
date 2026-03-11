export interface OrgEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export type OrganizationRole = "owner" | "admin" | "member";

export interface OrganizationMembership {
  slug: string;
  owner: string;
  role: OrganizationRole;
}

export interface OrganizationTeamMembership {
  organizationSlug: string;
  teamSlug: string;
}

export interface OrganizationMember {
  username: string;
  owner: string;
  role: OrganizationRole;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationTeamMember {
  username: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationTeam {
  teamSlug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: OrganizationTeamMember[];
}

export interface OrganizationSkill {
  skillId: string;
  owner: string;
  username: string;
  skill: string;
  visibility: "public" | "private";
  latestVersion: string | null;
  updatedAt: string;
  teamSlug?: string;
}

export interface OrganizationMembersResponse {
  slug: string;
  owner: string;
  viewerRole: OrganizationRole;
  members: OrganizationMember[];
}

export interface OrganizationMemberMutationResponse {
  slug: string;
  username: string;
  owner: string;
  role: OrganizationRole;
}

export interface OrganizationMemberRemoveResponse {
  status: "removed";
  slug: string;
  username: string;
}

export interface OrganizationTeamsResponse {
  slug: string;
  owner: string;
  viewerRole: OrganizationRole;
  teams: OrganizationTeam[];
}

export interface OrganizationTeamResponse {
  slug: string;
  owner: string;
  viewerRole: OrganizationRole;
  team: OrganizationTeam;
}

export interface OrganizationTeamCreateResponse {
  slug: string;
  teamSlug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationTeamMemberMutationResponse {
  slug: string;
  teamSlug: string;
  username: string;
  owner: string;
}

export interface OrganizationTeamMemberRemoveResponse {
  status: "removed";
  slug: string;
  teamSlug: string;
  username: string;
}

export interface OrganizationSkillsResponse {
  slug: string;
  owner: string;
  viewerRole: OrganizationRole;
  skills: OrganizationSkill[];
}

export interface OrganizationSkillTeamUpdateResponse {
  slug: string;
  skill: OrganizationSkill;
}

export type ParsedOrgFlags =
  | { valid: true; action: "ls"; json: boolean }
  | { valid: true; action: "members.ls"; slug: string; json: boolean }
  | {
      valid: true;
      action: "members.add";
      slug: string;
      username: string;
      role: OrganizationRole;
      json: boolean;
    }
  | { valid: true; action: "members.rm"; slug: string; username: string; json: boolean }
  | { valid: true; action: "team.ls"; slug: string; json: boolean }
  | {
      valid: true;
      action: "team.add";
      slug: string;
      teamSlug: string;
      name: string;
      json: boolean;
    }
  | { valid: true; action: "team.members.ls"; slug: string; teamSlug: string; json: boolean }
  | {
      valid: true;
      action: "team.members.add";
      slug: string;
      teamSlug: string;
      username: string;
      json: boolean;
    }
  | {
      valid: true;
      action: "team.members.rm";
      slug: string;
      teamSlug: string;
      username: string;
      json: boolean;
    }
  | { valid: true; action: "skills.ls"; slug: string; json: boolean }
  | {
      valid: true;
      action: "skills.team.set";
      slug: string;
      skillSlug: string;
      teamSlug: string;
      json: boolean;
    }
  | {
      valid: true;
      action: "skills.team.clear";
      slug: string;
      skillSlug: string;
      json: boolean;
    }
  | { valid: false; json: false };
