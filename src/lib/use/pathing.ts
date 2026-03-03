import { join } from "node:path";

import {
  DEFAULT_AGENT_TARGET,
  parseCustomAgentSlug,
  type AgentTarget,
} from "../shared/agent-target";

const INSTALL_REGISTRY_HOST = "registry.skillmarkdown.com";

export function resolveRegistryHost(baseUrl: string): string {
  void baseUrl;
  return INSTALL_REGISTRY_HOST;
}

export function resolveInstalledSkillPath(
  cwd: string,
  registryBaseUrl: string,
  ownerSlug: string,
  skillSlug: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
): string {
  return join(
    resolveInstalledSkillsHostRoot(cwd, registryBaseUrl, agentTarget),
    ownerSlug,
    skillSlug,
  );
}

export function resolveInstallTempRoot(
  cwd: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
): string {
  if (agentTarget === "skillmd") {
    return join(cwd, ".agent", ".tmp");
  }

  if (agentTarget === "claude") {
    return join(cwd, ".claude", ".tmp");
  }

  if (agentTarget === "gemini") {
    return join(cwd, ".gemini", ".tmp");
  }

  const slug = parseCustomAgentSlug(agentTarget);
  if (!slug) {
    return join(cwd, ".agent", ".tmp");
  }

  return join(cwd, ".agents", ".tmp", slug);
}

function resolveSkillsTargetRoot(cwd: string, agentTarget: AgentTarget): string {
  if (agentTarget === "skillmd") {
    return join(cwd, ".agent", "skills");
  }

  if (agentTarget === "claude") {
    return join(cwd, ".claude", "skills");
  }

  if (agentTarget === "gemini") {
    return join(cwd, ".gemini", "skills");
  }

  const slug = parseCustomAgentSlug(agentTarget);
  if (!slug) {
    return join(cwd, ".agent", "skills");
  }

  return join(cwd, ".agents", "skills", slug);
}

export function resolveInstalledSkillsHostRoot(
  cwd: string,
  registryBaseUrl: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
): string {
  return join(resolveSkillsTargetRoot(cwd, agentTarget), resolveRegistryHost(registryBaseUrl));
}
