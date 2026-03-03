import { fetchWithTimeout } from "../shared/http";
import {
  authHeaders,
  extractApiErrorFields,
  parseJsonOrThrow,
  type ApiErrorPayload,
} from "../shared/api-client";
import { isAgentTarget } from "../shared/agent-target";
import { UseApiError } from "./errors";
import {
  type ArtifactDescriptorRequest,
  type ArtifactDescriptorResponse,
  type ResolveSkillVersionResponse,
  type UseDownloadResult,
} from "./types";

interface UseClientOptions {
  timeoutMs?: number;
  idToken?: string;
}

function toUseApiError(status: number, payload: ApiErrorPayload): UseApiError {
  const parsed = extractApiErrorFields(status, payload, `use API request failed (${status})`);
  return new UseApiError(status, parsed.code, parsed.message, parsed.details);
}

function isResolveResponse(value: unknown): value is ResolveSkillVersionResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.ownerLogin === "string" &&
    typeof record.skill === "string" &&
    typeof record.spec === "string" &&
    typeof record.version === "string" &&
    (record.agentTarget === undefined || isAgentTarget(record.agentTarget))
  );
}

function isArtifactDescriptorResponse(value: unknown): value is ArtifactDescriptorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.owner === "string" &&
    typeof record.ownerLogin === "string" &&
    typeof record.skill === "string" &&
    typeof record.version === "string" &&
    typeof record.digest === "string" &&
    typeof record.sizeBytes === "number" &&
    typeof record.mediaType === "string" &&
    typeof record.yanked === "boolean" &&
    (typeof record.yankedAt === "string" || record.yankedAt === null) &&
    (typeof record.yankedReason === "string" || record.yankedReason === null) &&
    typeof record.downloadUrl === "string" &&
    typeof record.downloadExpiresAt === "string" &&
    (record.agentTarget === undefined || isAgentTarget(record.agentTarget))
  );
}

function sanitizeDownloadOrigin(downloadUrl: string): string {
  try {
    return new URL(downloadUrl).origin;
  } catch {
    return "redacted";
  }
}

export async function resolveSkillVersion(
  baseUrl: string,
  ownerSlug: string,
  skillSlug: string,
  spec: string,
  options: UseClientOptions = {},
): Promise<ResolveSkillVersionResponse> {
  const url = new URL(`${baseUrl}/v1/skills/${ownerSlug}/${skillSlug}/resolve`);
  url.searchParams.set("spec", spec);
  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers: authHeaders(options.idToken) },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<ResolveSkillVersionResponse | ApiErrorPayload>(
    response,
    "Resolve API",
  );

  if (!response.ok) {
    throw toUseApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isResolveResponse(parsed)) {
    throw new Error("Resolve API response was missing required fields");
  }

  return parsed;
}

export async function getArtifactDescriptor(
  baseUrl: string,
  request: ArtifactDescriptorRequest,
  options: UseClientOptions = {},
): Promise<ArtifactDescriptorResponse> {
  const url = new URL(
    `${baseUrl}/v1/skills/${request.ownerSlug}/${request.skillSlug}/versions/${request.version}/artifact`,
  );
  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers: authHeaders(options.idToken) },
    { timeoutMs: options.timeoutMs },
  );
  const parsed = await parseJsonOrThrow<ArtifactDescriptorResponse | ApiErrorPayload>(
    response,
    "Artifact descriptor API",
  );

  if (!response.ok) {
    throw toUseApiError(response.status, parsed as ApiErrorPayload);
  }

  if (!isArtifactDescriptorResponse(parsed)) {
    throw new Error("Artifact descriptor API response was missing required fields");
  }

  return parsed;
}

export async function downloadArtifact(
  downloadUrl: string,
  options: UseClientOptions = {},
): Promise<UseDownloadResult> {
  const response = await fetchWithTimeout(
    downloadUrl,
    { method: "GET" },
    { timeoutMs: options.timeoutMs },
  );

  if (!response.ok) {
    throw new Error(`artifact download failed (${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? undefined;

  return {
    bytes,
    downloadedFrom: sanitizeDownloadOrigin(downloadUrl),
    contentType,
  };
}
