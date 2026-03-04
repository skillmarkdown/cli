import { fetchWithTimeout } from "../shared/http";
import {
  extractApiErrorFields,
  parseApiResponse,
  type ApiErrorPayload,
} from "../shared/api-client";
import { PublishApiError } from "./errors";
import {
  type CommitPublishRequest,
  type CommitPublishResponse,
  type PreparePublishRequest,
  type PreparePublishResponse,
} from "./types";

interface PublishClientOptions {
  timeoutMs?: number;
}

function toPublishApiError(status: number, payload: ApiErrorPayload): PublishApiError {
  const parsed = extractApiErrorFields(status, payload, `publish API request failed (${status})`);
  return new PublishApiError(status, parsed.code, parsed.message, parsed.details);
}

function parseHeaders(headers: Record<string, string> | undefined): HeadersInit | undefined {
  if (!headers) {
    return undefined;
  }

  return Object.entries(headers);
}

function isPreparePublishResponse(value: unknown): value is PreparePublishResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as PreparePublishResponse & {
    publishToken?: unknown;
    uploadUrl?: unknown;
  };

  if (response.status !== "upload_required" && response.status !== "idempotent") {
    return false;
  }

  if (typeof response.publishToken !== "string") {
    return false;
  }

  if (response.status === "upload_required" && typeof response.uploadUrl !== "string") {
    return false;
  }

  return true;
}

function isCommitPublishResponse(value: unknown): value is CommitPublishResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as CommitPublishResponse;
  return (
    (response.status === "published" || response.status === "idempotent") &&
    typeof response.skillId === "string" &&
    typeof response.version === "string" &&
    typeof response.tag === "string" &&
    !!response.distTags &&
    typeof response.distTags === "object"
  );
}

export async function preparePublish(
  baseUrl: string,
  idToken: string,
  payload: PreparePublishRequest,
  options: PublishClientOptions = {},
): Promise<PreparePublishResponse> {
  const response = await fetchWithTimeout(
    `${baseUrl}/v1/publish/prepare`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: options.timeoutMs },
  );

  return parseApiResponse(response, {
    label: "Publish prepare API",
    isValid: isPreparePublishResponse,
    missingFieldsMessage: "Publish prepare API response was missing required fields",
    toApiError: toPublishApiError,
  });
}

export async function uploadArtifact(
  uploadUrl: string,
  tarGz: Buffer,
  mediaType: string,
  uploadMethod: "PUT" | "POST" = "PUT",
  uploadHeaders?: Record<string, string>,
  options: PublishClientOptions = {},
): Promise<void> {
  const headers = new Headers(parseHeaders(uploadHeaders));
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", mediaType);
  }

  const response = await fetchWithTimeout(
    uploadUrl,
    {
      method: uploadMethod,
      headers,
      body: new Uint8Array(tarGz),
    },
    { timeoutMs: options.timeoutMs },
  );

  if (!response.ok) {
    throw new Error(`artifact upload failed (${response.status})`);
  }
}

export async function commitPublish(
  baseUrl: string,
  idToken: string,
  payload: CommitPublishRequest,
  options: PublishClientOptions = {},
): Promise<CommitPublishResponse> {
  const response = await fetchWithTimeout(
    `${baseUrl}/v1/publish/commit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: options.timeoutMs },
  );

  return parseApiResponse(response, {
    label: "Publish commit API",
    isValid: isCommitPublishResponse,
    missingFieldsMessage: "Publish commit API response was missing required fields",
    toApiError: toPublishApiError,
  });
}
