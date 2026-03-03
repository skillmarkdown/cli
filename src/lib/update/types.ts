import { type InstallIntent } from "../use/types";
import { type AgentTarget } from "../shared/agent-target";

export interface UpdateFlags {
  all: boolean;
  allowYanked: boolean;
  json: boolean;
  skillIds: string[];
  agentTarget?: AgentTarget;
  valid: boolean;
}

export interface InstalledSkillTarget {
  skillId: string;
  ownerSlug: string;
  skillSlug: string;
  installedPath: string;
  agentTarget: AgentTarget;
}

export interface InstalledSkillRecord extends InstalledSkillTarget {
  metadata: UpdateInstalledMetadata | null;
}

export type UpdateMode = "all" | "ids";

export type ResolvedUpdateSelector =
  | { strategy: "version"; value: string }
  | { strategy: "channel"; value: "latest" | "beta" }
  | { strategy: "latest_fallback_beta"; value: null };

export interface UpdateIntentResolution {
  selector: ResolvedUpdateSelector;
  installIntent: InstallIntent;
}

export interface UpdateInstalledMetadata {
  skillId?: string;
  ownerLogin?: string;
  skill?: string;
  version?: string;
  digest?: string;
  sizeBytes?: number;
  mediaType?: string;
  registryBaseUrl?: string;
  downloadedFrom?: string;
  installedAt?: string;
  sourceCommand?: string;
  installIntent?: InstallIntent;
  agentTarget?: AgentTarget;
}

export interface UpdateCommandEntry {
  skillId: string;
  agentTarget?: AgentTarget;
  installedPath?: string;
  fromVersion?: string;
  toVersion?: string;
  status: "updated" | "skipped_pinned" | "failed";
  reason?: string;
}

export interface UpdateJsonEntry {
  skillId: string;
  agentTarget?: AgentTarget;
  installedPath?: string;
  status: "updated" | "skipped_pinned" | "failed";
  fromVersion?: string;
  toVersion?: string;
  reason?: string;
}

export interface UpdateJsonResult {
  mode: UpdateMode;
  total: number;
  updated: UpdateJsonEntry[];
  skipped: UpdateJsonEntry[];
  failed: UpdateJsonEntry[];
}
