import { type PublishChannel } from "../publish/types";

export interface UseFlags {
  skillId?: string;
  version?: string;
  channel?: PublishChannel;
  allowYanked: boolean;
  json: boolean;
  valid: boolean;
}

export interface UseEnvConfig {
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export interface ResolveSkillVersionResponse {
  owner: string;
  ownerLogin: string;
  skill: string;
  channel: PublishChannel;
  version: string;
}

export interface ArtifactDescriptorRequest {
  ownerSlug: string;
  skillSlug: string;
  version: string;
}

export interface ArtifactDescriptorResponse {
  owner: string;
  ownerLogin: string;
  skill: string;
  version: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  yanked: boolean;
  yankedAt: string | null;
  yankedReason: string | null;
  downloadUrl: string;
  downloadExpiresAt: string;
}

export interface UseDownloadResult {
  bytes: Buffer;
  downloadedFrom: string;
  contentType?: string;
}

export type InstallIntentStrategy = "version" | "channel" | "latest_fallback_beta";

export interface InstallIntent {
  strategy: InstallIntentStrategy;
  value: string | null;
}

export interface InstalledSkillMetadata {
  skillId: string;
  ownerLogin: string;
  skill: string;
  version: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  registryBaseUrl: string;
  downloadedFrom: string;
  installedAt: string;
  sourceCommand: string;
  installIntent: InstallIntent;
}

export interface UseCommandResult {
  skillId: string;
  ownerLogin: string;
  skill: string;
  version: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  installedPath: string;
  registryBaseUrl: string;
  installedAt: string;
  source: "registry";
}

export type InstallSelector =
  | { strategy: "version"; version: string }
  | { strategy: "channel"; channel: PublishChannel }
  | { strategy: "latest_fallback_beta" };

export interface InstallWorkflowResult {
  result: UseCommandResult;
  metadata: InstalledSkillMetadata;
  resolvedChannel?: PublishChannel;
}
