import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { OrgApiError } from "./errors";
import {
  type CreatedOrganizationTokenResponse,
  type OrganizationMemberMutationResponse,
  type OrganizationMemberRemoveResponse,
  type OrganizationMembersResponse,
  type OrganizationRole,
  type OrganizationSkillTeamUpdateResponse,
  type OrganizationSkillsResponse,
  type OrganizationTokenRevokeResponse,
  type OrganizationTokensResponse,
  type OrganizationTeamCreateResponse,
  type OrganizationTeamMemberMutationResponse,
  type OrganizationTeamMemberRemoveResponse,
  type OrganizationTeamResponse,
  type OrganizationTeamsResponse,
  type OrganizationTokenScope,
} from "./types";

interface OrgClientOptions {
  timeoutMs?: number;
}

function toOrgApiError(status: number, payload: ApiErrorPayload): OrgApiError {
  const parsed = extractApiErrorFields(
    status,
    payload,
    `organization API request failed (${status})`,
  );
  return new OrgApiError(status, parsed.code, parsed.message, parsed.details);
}

function isRole(value: unknown): value is OrganizationRole {
  return value === "owner" || value === "admin" || value === "member";
}

function isOrganizationTokenScope(value: unknown): value is OrganizationTokenScope {
  return value === "publish" || value === "admin";
}

function isMember(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.username === "string" &&
    typeof record.owner === "string" &&
    isRole(record.role) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function isTeamMember(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.username === "string" &&
    typeof record.owner === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function isTeam(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.teamSlug === "string" &&
    typeof record.name === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.members) &&
    record.members.every(isTeamMember)
  );
}

function isSkill(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.skillId === "string" &&
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    typeof record.skill === "string" &&
    (record.visibility === "public" || record.visibility === "private") &&
    (record.latestVersion === null || typeof record.latestVersion === "string") &&
    typeof record.updatedAt === "string" &&
    (record.teamSlug === undefined || typeof record.teamSlug === "string")
  );
}

function isOrganizationMembersResponse(value: unknown): value is OrganizationMembersResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.owner === "string" &&
    isRole(record.viewerRole) &&
    Array.isArray(record.members) &&
    record.members.every(isMember)
  );
}

function isOrganizationMemberMutationResponse(
  value: unknown,
): value is OrganizationMemberMutationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.username === "string" &&
    typeof record.owner === "string" &&
    isRole(record.role)
  );
}

function isOrganizationMemberRemoveResponse(
  value: unknown,
): value is OrganizationMemberRemoveResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.status === "removed" &&
    typeof record.slug === "string" &&
    typeof record.username === "string"
  );
}

function isOrganizationTeamsResponse(value: unknown): value is OrganizationTeamsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.owner === "string" &&
    isRole(record.viewerRole) &&
    Array.isArray(record.teams) &&
    record.teams.every(isTeam)
  );
}

function isOrganizationTeamResponse(value: unknown): value is OrganizationTeamResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.owner === "string" &&
    isRole(record.viewerRole) &&
    isTeam(record.team)
  );
}

function isOrganizationTeamCreateResponse(value: unknown): value is OrganizationTeamCreateResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.teamSlug === "string" &&
    typeof record.name === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function isOrganizationTeamMemberMutationResponse(
  value: unknown,
): value is OrganizationTeamMemberMutationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.teamSlug === "string" &&
    typeof record.username === "string" &&
    typeof record.owner === "string"
  );
}

function isOrganizationTeamMemberRemoveResponse(
  value: unknown,
): value is OrganizationTeamMemberRemoveResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.status === "removed" &&
    typeof record.slug === "string" &&
    typeof record.teamSlug === "string" &&
    typeof record.username === "string"
  );
}

function isOrganizationSkillsResponse(value: unknown): value is OrganizationSkillsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" &&
    typeof record.owner === "string" &&
    isRole(record.viewerRole) &&
    Array.isArray(record.skills) &&
    record.skills.every(isSkill)
  );
}

function isOrganizationSkillTeamUpdateResponse(
  value: unknown,
): value is OrganizationSkillTeamUpdateResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.slug === "string" && isSkill(record.skill);
}

function isCreatedOrganizationTokenResponse(
  value: unknown,
): value is CreatedOrganizationTokenResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.tokenId === "string" &&
    typeof record.token === "string" &&
    typeof record.name === "string" &&
    isOrganizationTokenScope(record.scope) &&
    typeof record.createdAt === "string" &&
    typeof record.expiresAt === "string"
  );
}

function isOrganizationTokensResponse(value: unknown): value is OrganizationTokensResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.tokens)) {
    return false;
  }
  return record.tokens.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const token = entry as Record<string, unknown>;
    return (
      typeof token.tokenId === "string" &&
      typeof token.name === "string" &&
      isOrganizationTokenScope(token.scope) &&
      typeof token.createdAt === "string" &&
      typeof token.expiresAt === "string" &&
      (token.revokedAt === undefined ||
        token.revokedAt === null ||
        typeof token.revokedAt === "string") &&
      (token.lastUsedAt === undefined ||
        token.lastUsedAt === null ||
        typeof token.lastUsedAt === "string")
    );
  });
}

function isOrganizationTokenRevokeResponse(
  value: unknown,
): value is OrganizationTokenRevokeResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.status === "revoked" && typeof record.tokenId === "string";
}

export async function listOrganizationMembers(
  baseUrl: string,
  idToken: string,
  slug: string,
  options: OrgClientOptions = {},
): Promise<OrganizationMembersResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/members`),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationMembersResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function addOrganizationMember(
  baseUrl: string,
  idToken: string,
  slug: string,
  request: { username: string; role: OrganizationRole },
  options: OrgClientOptions = {},
): Promise<OrganizationMemberMutationResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/members`),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationMemberMutationResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function removeOrganizationMember(
  baseUrl: string,
  idToken: string,
  slug: string,
  username: string,
  options: OrgClientOptions = {},
): Promise<OrganizationMemberRemoveResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/members/${encodeURIComponent(username)}`,
    ),
    method: "DELETE",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationMemberRemoveResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function listOrganizationTeams(
  baseUrl: string,
  idToken: string,
  slug: string,
  options: OrgClientOptions = {},
): Promise<OrganizationTeamsResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/teams`),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTeamsResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function getOrganizationTeam(
  baseUrl: string,
  idToken: string,
  slug: string,
  teamSlug: string,
  options: OrgClientOptions = {},
): Promise<OrganizationTeamResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamSlug)}`,
    ),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTeamResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function createOrganizationTeam(
  baseUrl: string,
  idToken: string,
  slug: string,
  request: { teamSlug: string; name: string },
  options: OrgClientOptions = {},
): Promise<OrganizationTeamCreateResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/teams`),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTeamCreateResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function addOrganizationTeamMember(
  baseUrl: string,
  idToken: string,
  slug: string,
  teamSlug: string,
  request: { username: string },
  options: OrgClientOptions = {},
): Promise<OrganizationTeamMemberMutationResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamSlug)}/members`,
    ),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTeamMemberMutationResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function removeOrganizationTeamMember(
  baseUrl: string,
  idToken: string,
  slug: string,
  teamSlug: string,
  username: string,
  options: OrgClientOptions = {},
): Promise<OrganizationTeamMemberRemoveResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamSlug)}/members/${encodeURIComponent(username)}`,
    ),
    method: "DELETE",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTeamMemberRemoveResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function listOrganizationSkills(
  baseUrl: string,
  idToken: string,
  slug: string,
  options: OrgClientOptions = {},
): Promise<OrganizationSkillsResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/skills`),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationSkillsResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function assignOrganizationSkillTeam(
  baseUrl: string,
  idToken: string,
  slug: string,
  skillSlug: string,
  teamSlug: string | null,
  options: OrgClientOptions = {},
): Promise<OrganizationSkillTeamUpdateResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/skills/${encodeURIComponent(skillSlug)}/team`,
    ),
    method: "PUT",
    idToken,
    body: { teamSlug },
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationSkillTeamUpdateResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function createOrganizationToken(
  baseUrl: string,
  idToken: string,
  slug: string,
  request: { name: string; scope?: OrganizationTokenScope; expiresDays?: number },
  options: OrgClientOptions = {},
): Promise<CreatedOrganizationTokenResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/tokens`),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isCreatedOrganizationTokenResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function listOrganizationTokens(
  baseUrl: string,
  idToken: string,
  slug: string,
  options: OrgClientOptions = {},
): Promise<OrganizationTokensResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/tokens`),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTokensResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}

export async function revokeOrganizationToken(
  baseUrl: string,
  idToken: string,
  slug: string,
  tokenId: string,
  options: OrgClientOptions = {},
): Promise<OrganizationTokenRevokeResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/organizations/${encodeURIComponent(slug)}/tokens/${encodeURIComponent(tokenId)}`,
    ),
    method: "DELETE",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Organization API",
    isValid: isOrganizationTokenRevokeResponse,
    missingFieldsMessage: "Organization API response was missing required fields",
    toApiError: toOrgApiError,
  });
}
