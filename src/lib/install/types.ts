import { type AgentTarget } from "../shared/agent-target";

export interface InstallFlags {
  prune: boolean;
  json: boolean;
  agentTarget?: AgentTarget;
  valid: boolean;
}

export interface InstallCommandEntry {
  skillId: string;
  agentTarget: AgentTarget;
  spec: string;
  fromVersion?: string;
  toVersion?: string;
  installedPath?: string;
  status: "installed" | "skipped" | "failed";
  reason?: string;
}

export interface InstallPrunedEntry {
  skillId: string;
  agentTarget: AgentTarget;
  installedPath?: string;
  status: "pruned" | "failed";
  reason?: string;
}

export interface InstallJsonResult {
  total: number;
  installed: InstallCommandEntry[];
  skipped: InstallCommandEntry[];
  failed: InstallCommandEntry[];
  pruned?: InstallPrunedEntry[];
}
