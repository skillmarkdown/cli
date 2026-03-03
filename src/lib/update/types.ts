import { type AgentTarget } from "../shared/agent-target";

export interface UpdateFlags {
  all: boolean;
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
  metadata: SkillsLockEntry | null;
}

export type UpdateMode = "all" | "ids";

export type ResolvedUpdateSelector =
  | { strategy: "version"; value: string }
  | { strategy: "spec"; value: string };

export interface UpdateIntentResolution {
  selector: ResolvedUpdateSelector;
}

export interface SkillsLockEntry {
  skillId: string;
  ownerLogin: string;
  skill: string;
  selectorSpec: string;
  resolvedVersion: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  installedPath: string;
  registryBaseUrl: string;
  installedAt: string;
  sourceCommand: string;
  downloadedFrom: string;
  agentTarget: AgentTarget;
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
