import { type AgentTarget } from "../shared/agent-target";

export interface UseFlags {
  skillId?: string;
  version?: string;
  spec?: string;
  agentTarget?: AgentTarget;
  json: boolean;
  save: boolean;
  valid: boolean;
}

export interface UseEnvConfig {
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
  defaultAgentTarget: AgentTarget;
}

export interface ResolveSkillVersionResponse {
  owner: string;
  ownerLogin: string;
  skill: string;
  spec: string;
  version: string;
  agentTarget?: AgentTarget;
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
  deprecated: boolean;
  deprecatedAt: string | null;
  deprecatedMessage: string | null;
  downloadUrl: string;
  downloadExpiresAt: string;
  agentTarget?: AgentTarget;
}

export interface UseDownloadResult {
  bytes: Buffer;
  downloadedFrom: string;
  contentType?: string;
}

export interface InstalledSkillLockEntry {
  skillId: string;
  ownerLogin: string;
  skill: string;
  selectorSpec: string;
  version: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  installedPath: string;
  registryBaseUrl: string;
  downloadedFrom: string;
  installedAt: string;
  sourceCommand: string;
  agentTarget: AgentTarget;
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
  agentTarget: AgentTarget;
}

export type InstallSelector =
  | { strategy: "version"; version: string }
  | { strategy: "spec"; spec: string };

export interface InstallWorkflowResult {
  result: UseCommandResult;
  lockEntry: InstalledSkillLockEntry;
  warnings: string[];
}
