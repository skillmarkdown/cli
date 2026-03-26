import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { CollaboratorsApiError } from "./errors";
import {
  type AddSkillCollaboratorResponse,
  type ListSkillCollaboratorsResponse,
  type RemoveSkillCollaboratorResponse,
} from "./types";

interface CollaboratorsClientOptions {
  timeoutMs?: number;
}

function toCollaboratorsApiError(status: number, payload: ApiErrorPayload): CollaboratorsApiError {
  const parsed = extractApiErrorFields(
    status,
    payload,
    `collaborators API request failed (${status})`,
  );
  return new CollaboratorsApiError(status, parsed.code, parsed.message, parsed.details);
}

function isMaintainerRole(value: unknown): value is "maintainer" {
  return value === "maintainer";
}

function isSkillCollaborator(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.username === "string" &&
    isMaintainerRole(record.role) &&
    typeof record.addedAt === "string" &&
    (record.avatarUrl === null || typeof record.avatarUrl === "string") &&
    (record.lastPublishedAt === null || typeof record.lastPublishedAt === "string")
  );
}

function isListSkillCollaboratorsResponse(value: unknown): value is ListSkillCollaboratorsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    typeof record.skill === "string" &&
    Array.isArray(record.collaborators) &&
    record.collaborators.every(isSkillCollaborator)
  );
}

function isAddSkillCollaboratorResponse(value: unknown): value is AddSkillCollaboratorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const collaborator = record.collaborator as Record<string, unknown> | undefined;
  return (
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    typeof record.skill === "string" &&
    !!collaborator &&
    typeof collaborator.username === "string" &&
    isMaintainerRole(collaborator.role)
  );
}

function isRemoveSkillCollaboratorResponse(
  value: unknown,
): value is RemoveSkillCollaboratorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const collaborator = record.collaborator as Record<string, unknown> | undefined;
  return (
    typeof record.owner === "string" &&
    typeof record.username === "string" &&
    typeof record.skill === "string" &&
    !!collaborator &&
    typeof collaborator.username === "string"
  );
}

export async function listSkillCollaborators(
  baseUrl: string,
  idToken: string,
  skillSlug: string,
  options: CollaboratorsClientOptions = {},
): Promise<ListSkillCollaboratorsResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/skills/${encodeURIComponent(skillSlug)}/collaborators`),
    method: "GET",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Collaborators API",
    isValid: isListSkillCollaboratorsResponse,
    missingFieldsMessage: "Collaborators API response was missing required fields",
    toApiError: toCollaboratorsApiError,
  });
}

export async function addSkillCollaborator(
  baseUrl: string,
  idToken: string,
  skillSlug: string,
  request: { username: string; role: "maintainer" },
  options: CollaboratorsClientOptions = {},
): Promise<AddSkillCollaboratorResponse> {
  return requestJson({
    url: new URL(`${baseUrl}/v1/skills/${encodeURIComponent(skillSlug)}/collaborators`),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "Collaborators API",
    isValid: isAddSkillCollaboratorResponse,
    missingFieldsMessage: "Collaborators API response was missing required fields",
    toApiError: toCollaboratorsApiError,
  });
}

export async function removeSkillCollaborator(
  baseUrl: string,
  idToken: string,
  skillSlug: string,
  username: string,
  options: CollaboratorsClientOptions = {},
): Promise<RemoveSkillCollaboratorResponse> {
  return requestJson({
    url: new URL(
      `${baseUrl}/v1/skills/${encodeURIComponent(skillSlug)}/collaborators/${encodeURIComponent(username)}`,
    ),
    method: "DELETE",
    idToken,
    timeoutMs: options.timeoutMs,
    label: "Collaborators API",
    isValid: isRemoveSkillCollaboratorResponse,
    missingFieldsMessage: "Collaborators API response was missing required fields",
    toApiError: toCollaboratorsApiError,
  });
}
