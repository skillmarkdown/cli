import { fetchWithTimeout } from "../shared/http";
import {
  extractApiErrorFields,
  parseJsonOrThrow,
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

  if ((parsed as PreparePublishResponse).status === "upload_required") {
    const upload = parsed as PreparePublishResponse & {
      publishToken?: unknown;
      uploadUrl?: unknown;
    };
    if (typeof upload.publishToken !== "string" || typeof upload.uploadUrl !== "string") {
      throw new Error("Publish prepare API response was missing required fields");
    }
  }

  if ((parsed as PreparePublishResponse).status === "idempotent") {
    const idempotent = parsed as PreparePublishResponse & {
      publishToken?: unknown;
    };
    if (typeof idempotent.publishToken !== "string") {
      throw new Error("Publish prepare API response was missing required fields");
    }
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

  const status = (parsed as CommitPublishResponse).status;
  if (
    (status !== "published" && status !== "idempotent") ||
    !(parsed as CommitPublishResponse).skillId ||
    !(parsed as CommitPublishResponse).version ||
    typeof (parsed as CommitPublishResponse).tag !== "string" ||
    !(parsed as CommitPublishResponse).distTags ||
    typeof (parsed as CommitPublishResponse).distTags !== "object"
  ) {
    throw new Error("Publish commit API response was missing required fields");
  }

  return parsed as CommitPublishResponse;
}
