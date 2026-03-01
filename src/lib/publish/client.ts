import { fetchWithTimeout } from "../shared/http";
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

interface ApiErrorPayload {
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

function toPublishApiError(status: number, payload: ApiErrorPayload): PublishApiError {
  const code = payload.code || "unknown_error";
  const message = payload.message || `publish API request failed (${status})`;
  return new PublishApiError(status, code, message, payload.details);
}

function parseHeaders(headers: Record<string, string> | undefined): HeadersInit | undefined {
  if (!headers) {
    return undefined;
  }

  return Object.entries(headers);
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

  const parsed = await parseJsonOrThrow<PreparePublishResponse | ApiErrorPayload>(
    response,
    "Publish prepare API",
  );

  if (!response.ok) {
    throw toPublishApiError(response.status, parsed as ApiErrorPayload);
  }

  if (
    (parsed as PreparePublishResponse).status !== "upload_required" &&
    (parsed as PreparePublishResponse).status !== "idempotent"
  ) {
    throw new Error("Publish prepare API response was missing required fields");
  }

  return parsed as PreparePublishResponse;
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

  const parsed = await parseJsonOrThrow<CommitPublishResponse | ApiErrorPayload>(
    response,
    "Publish commit API",
  );

  if (!response.ok) {
    throw toPublishApiError(response.status, parsed as ApiErrorPayload);
  }

  if (
    (parsed as CommitPublishResponse).status !== "published" ||
    !(parsed as CommitPublishResponse).skillId ||
    !(parsed as CommitPublishResponse).version
  ) {
    throw new Error("Publish commit API response was missing required fields");
  }

  return parsed as CommitPublishResponse;
}
