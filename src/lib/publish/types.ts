export const PUBLISH_MEDIA_TYPE = "application/vnd.skillmarkdown.skill.v1+tar";
export const MAX_PUBLISH_ARTIFACT_SIZE_BYTES = 25 * 1024 * 1024;

export const PUBLISH_CHANNELS = ["latest", "beta"] as const;
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number];

export interface PublishFlags {
  pathArg?: string;
  owner?: string;
  version?: string;
  channel?: PublishChannel;
  dryRun: boolean;
  json: boolean;
  valid: boolean;
}

export interface PackedFileEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface PackedArtifact {
  mediaType: string;
  tarGz: Buffer;
  digest: string;
  sizeBytes: number;
  files: PackedFileEntry[];
}

export interface PublishManifest {
  schemaVersion: "skillmd.publish.v1";
  skillId: string;
  owner: string;
  skill: string;
  version: string;
  channel: PublishChannel;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  description?: string;
  files: PackedFileEntry[];
}

export interface PublishEnvConfig {
  registryBaseUrl: string;
  requestTimeoutMs: number;
  firebaseApiKey: string;
  firebaseProjectId: string;
}

export interface PreparePublishRequest {
  owner: string;
  skill: string;
  version: string;
  channel: PublishChannel;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  manifest: PublishManifest;
}

export interface PreparePublishUploadResponse {
  status: "upload_required";
  publishToken: string;
  uploadUrl: string;
  uploadMethod?: "PUT" | "POST";
  uploadHeaders?: Record<string, string>;
}

export interface PreparePublishIdempotentResponse {
  status: "idempotent";
  skillId: string;
  version: string;
  digest: string;
  channel: PublishChannel;
}

export type PreparePublishResponse =
  | PreparePublishUploadResponse
  | PreparePublishIdempotentResponse;

export interface CommitPublishRequest {
  publishToken: string;
}

export interface CommitPublishResponse {
  status: "published";
  skillId: string;
  version: string;
  digest: string;
  channel: PublishChannel;
}
