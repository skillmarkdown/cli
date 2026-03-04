import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseApiResponse,
  type ApiErrorPayload,
} from "../shared/api-client";
import { TeamApiError } from "./errors";
import {
  type TeamCreateRequest,
  type TeamMemberAddRequest,
  type TeamMemberMutationResponse,
  type TeamMembersResponse,
  type TeamMemberUpdateRequest,
  type TeamRecord,
  type TeamRole,
} from "./types";

interface TeamClientOptions {
  timeoutMs?: number;
}

function toTeamApiError(status: number, payload: ApiErrorPayload): TeamApiError {
  const parsed = extractApiErrorFields(status, payload, `team API request failed (${status})`);
  return new TeamApiError(status, parsed.code, parsed.message, parsed.details);
}

function isRole(value: unknown): value is TeamRole {
  return value === "owner" || value === "admin" || value === "member";
}

function isTeamRecord(value: unknown): value is TeamRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.team === "string" &&
    typeof record.displayName === "string" &&
    typeof record.createdAt === "string" &&
    (record.updatedAt === undefined || typeof record.updatedAt === "string") &&
    isRole(record.role)
  );
}

interface TeamMemberMutationWireResponse {
  status: "added" | "updated" | "removed";
  team: string;
  member?: {
    ownerLogin: string;
    owner: string;
    role: TeamRole;
  };
  ownerLogin?: string;
}

function isTeamMemberMutationWireResponse(value: unknown): value is TeamMemberMutationWireResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.team !== "string" ||
    (record.status !== "added" && record.status !== "updated" && record.status !== "removed")
  ) {
    return false;
  }
  if (record.status === "removed") {
    return typeof record.ownerLogin === "string";
  }
  if (!record.member || typeof record.member !== "object") {
    return false;
  }
  const member = record.member as Record<string, unknown>;
  return (
    typeof member.ownerLogin === "string" && typeof member.owner === "string" && isRole(member.role)
  );
}

function toMemberMutationResponse(
  wire: TeamMemberMutationWireResponse,
): TeamMemberMutationResponse {
  if (wire.status === "removed") {
    const ownerLogin = wire.ownerLogin ?? "";
    return {
      status: wire.status,
      team: wire.team,
      ownerLogin,
      owner: `@${ownerLogin}`,
      role: "member",
    };
  }
  return {
    status: wire.status,
    team: wire.team,
    ownerLogin: wire.member?.ownerLogin ?? "",
    owner: wire.member?.owner ?? "",
    role: wire.member?.role ?? "member",
  };
}

function isTeamMembersResponse(value: unknown): value is TeamMembersResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.team !== "string" || !Array.isArray(record.members)) {
    return false;
  }

  return record.members.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const member = entry as Record<string, unknown>;
    return (
      typeof member.owner === "string" &&
      typeof member.ownerLogin === "string" &&
      isRole(member.role) &&
      typeof member.addedAt === "string" &&
      typeof member.updatedAt === "string"
    );
  });
}

export async function createTeam(
  baseUrl: string,
  idToken: string,
  request: TeamCreateRequest,
  options: TeamClientOptions = {},
): Promise<TeamRecord> {
  const response = await fetchWithTimeout(
    new URL(`${baseUrl}/v1/teams`),
    {
      method: "POST",
      headers: {
        ...(authHeaders(idToken) ?? {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    { timeoutMs: options.timeoutMs },
  );

  return parseApiResponse(response, {
    label: "Team API",
    isValid: isTeamRecord,
    missingFieldsMessage: "Team API response was missing required fields",
    toApiError: toTeamApiError,
  });
}

export async function getTeam(
  baseUrl: string,
  idToken: string,
  teamSlug: string,
  options: TeamClientOptions = {},
): Promise<TeamRecord> {
  const response = await fetchWithTimeout(
    new URL(`${baseUrl}/v1/teams/${encodeURIComponent(teamSlug)}`),
    {
      method: "GET",
      headers: authHeaders(idToken),
    },
    { timeoutMs: options.timeoutMs },
  );

  return parseApiResponse(response, {
    label: "Team API",
    isValid: isTeamRecord,
    missingFieldsMessage: "Team API response was missing required fields",
    toApiError: toTeamApiError,
  });
}

export async function listTeamMembers(
  baseUrl: string,
  idToken: string,
  teamSlug: string,
  options: TeamClientOptions = {},
): Promise<TeamMembersResponse> {
  const response = await fetchWithTimeout(
    new URL(`${baseUrl}/v1/teams/${encodeURIComponent(teamSlug)}/members`),
    {
      method: "GET",
      headers: authHeaders(idToken),
    },
    { timeoutMs: options.timeoutMs },
  );

  return parseApiResponse(response, {
    label: "Team API",
    isValid: isTeamMembersResponse,
    missingFieldsMessage: "Team API response was missing required fields",
    toApiError: toTeamApiError,
  });
}

export async function addTeamMember(
  baseUrl: string,
  idToken: string,
  teamSlug: string,
  request: TeamMemberAddRequest,
  options: TeamClientOptions = {},
): Promise<TeamMemberMutationResponse> {
  const response = await fetchWithTimeout(
    new URL(`${baseUrl}/v1/teams/${encodeURIComponent(teamSlug)}/members`),
    {
      method: "POST",
      headers: {
        ...(authHeaders(idToken) ?? {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    { timeoutMs: options.timeoutMs },
  );

  const parsed = await parseApiResponse(response, {
    label: "Team API",
    isValid: isTeamMemberMutationWireResponse,
    missingFieldsMessage: "Team API response was missing required fields",
    toApiError: toTeamApiError,
  });
  return toMemberMutationResponse(parsed);
}

export async function updateTeamMemberRole(
  baseUrl: string,
  idToken: string,
  teamSlug: string,
  ownerLogin: string,
  request: TeamMemberUpdateRequest,
  options: TeamClientOptions = {},
): Promise<TeamMemberMutationResponse> {
  const response = await fetchWithTimeout(
    new URL(
      `${baseUrl}/v1/teams/${encodeURIComponent(teamSlug)}/members/${encodeURIComponent(ownerLogin)}`,
    ),
    {
      method: "PATCH",
      headers: {
        ...(authHeaders(idToken) ?? {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    { timeoutMs: options.timeoutMs },
  );

  const parsed = await parseApiResponse(response, {
    label: "Team API",
    isValid: isTeamMemberMutationWireResponse,
    missingFieldsMessage: "Team API response was missing required fields",
    toApiError: toTeamApiError,
  });
  return toMemberMutationResponse(parsed);
}

export async function removeTeamMember(
  baseUrl: string,
  idToken: string,
  teamSlug: string,
  ownerLogin: string,
  options: TeamClientOptions = {},
): Promise<TeamMemberMutationResponse> {
  const response = await fetchWithTimeout(
    new URL(
      `${baseUrl}/v1/teams/${encodeURIComponent(teamSlug)}/members/${encodeURIComponent(ownerLogin)}`,
    ),
    {
      method: "DELETE",
      headers: authHeaders(idToken),
    },
    { timeoutMs: options.timeoutMs },
  );

  const parsed = await parseApiResponse(response, {
    label: "Team API",
    isValid: isTeamMemberMutationWireResponse,
    missingFieldsMessage: "Team API response was missing required fields",
    toApiError: toTeamApiError,
  });
  return toMemberMutationResponse(parsed);
}
