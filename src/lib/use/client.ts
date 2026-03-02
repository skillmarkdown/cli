import { fetchWithTimeout } from "../shared/http";
import { type PublishChannel } from "../publish/types";
import { UseApiError } from "./errors";
import {
  type ArtifactDescriptorRequest,
  type ArtifactDescriptorResponse,
  type ResolveSkillVersionResponse,
  type UseDownloadResult,
} from "./types";

interface UseClientOptions {
  timeoutMs?: number;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  code?: string;
  message?: string;
  details?: unknown;
}

async function parseJsonOrThrow<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned non-JSON response (${response.status})`);
  }
}

function toUseApiError(status: number, payload: ApiErrorPayload): UseApiError {
  const nested = payload.error;
  const code = nested?.code || payload.code || "unknown_error";
  const message = nested?.message || payload.message || `use API request failed (${status})`;
  return new UseApiError(status, code, message, nested?.details ?? payload.details);
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
    (record.channel === "latest" || record.channel === "beta") &&
    typeof record.version === "string"
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
    typeof record.downloadExpiresAt === "string"
  );
}

export async function resolveSkillVersion(
  baseUrl: string,
  ownerSlug: string,
  skillSlug: string,
  channel: PublishChannel,
  options: UseClientOptions = {},
): Promise<ResolveSkillVersionResponse> {
  const url = new URL(`${baseUrl}/v1/skills/${ownerSlug}/${skillSlug}/resolve`);
  url.searchParams.set("channel", channel);

  const response = await fetchWithTimeout(url, { method: "GET" }, { timeoutMs: options.timeoutMs });
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
  const response = await fetchWithTimeout(url, { method: "GET" }, { timeoutMs: options.timeoutMs });
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
    downloadedFrom: downloadUrl,
    contentType,
  };
}
