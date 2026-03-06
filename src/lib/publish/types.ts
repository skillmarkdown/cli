import { type AgentTarget } from "../shared/agent-target";

export const PUBLISH_MEDIA_TYPE = "application/vnd.skillmarkdown.skill.v1+tar";
export const MAX_PUBLISH_ARTIFACT_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_PUBLISH_MANIFEST_SIZE_BYTES = 256 * 1024;
export const MAX_PUBLISH_README_SIZE_BYTES = 512 * 1024;

export const PUBLISH_ACCESSES = ["public", "private"] as const;
export type PublishAccess = (typeof PUBLISH_ACCESSES)[number];

export interface PublishFlags {
  pathArg?: string;
  version?: string;
  tag?: string;
  access?: PublishAccess;
  provenance: boolean;
  agentTarget?: AgentTarget;
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
  skill: string;
  version: string;
  tag: string;
  access: PublishAccess;
  provenance: boolean;
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
  defaultAgentTarget: AgentTarget;
}

export interface PreparePublishRequest {
  skill: string;
  version: string;
  tag: string;
  access: PublishAccess;
  provenance: boolean;
  packageMeta: Record<string, unknown> & {
    name: string;
    version: string;
    description: string;
  };
  agentTarget?: AgentTarget;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  manifest: PublishManifest;
  readme?: string;
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
  publishToken: string;
  expiresAt?: string;
}

export type PreparePublishResponse =
  | PreparePublishUploadResponse
  | PreparePublishIdempotentResponse;

export interface CommitPublishRequest {
  publishToken: string;
}

export interface CommitPublishResponse {
  status: "published" | "idempotent";
  skillId: string;
  version: string;
  tag: string;
  distTags: Record<string, string>;
  agentTarget?: AgentTarget;
  provenance: {
    requested: boolean;
    recorded: boolean;
  };
}
