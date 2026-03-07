import { join } from "node:path";

import {
  DEFAULT_AGENT_TARGET,
  parseCustomAgentSlug,
  type AgentTarget,
  type BuiltinAgentTarget,
} from "../shared/agent-target";

const INSTALL_REGISTRY_HOST = "registry.skillmarkdown.com";
const BUILTIN_AGENT_TARGET_DIRS: Record<BuiltinAgentTarget, string> = {
  skillmd: ".agent",
  openai: ".openai",
  claude: ".claude",
  gemini: ".gemini",
  meta: ".meta",
  mistral: ".mistral",
  deepseek: ".deepseek",
  perplexity: ".perplexity",
};

export function resolveRegistryHost(baseUrl: string): string {
  void baseUrl;
  return INSTALL_REGISTRY_HOST;
}

export function resolveInstalledSkillPath(
  cwd: string,
  registryBaseUrl: string,
  username: string,
  skillSlug: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
): string {
  return join(
    resolveInstalledSkillsHostRoot(cwd, registryBaseUrl, agentTarget),
    username,
    skillSlug,
  );
}

export function resolveInstallTempRoot(
  cwd: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
): string {
  const builtinDir = BUILTIN_AGENT_TARGET_DIRS[agentTarget as BuiltinAgentTarget];
  if (builtinDir) {
    return join(cwd, builtinDir, ".tmp");
  }

  const slug = parseCustomAgentSlug(agentTarget);
  if (!slug) {
    return join(cwd, ".agent", ".tmp");
  }

  return join(cwd, ".agents", ".tmp", slug);
}

function resolveSkillsTargetRoot(cwd: string, agentTarget: AgentTarget): string {
  const builtinDir = BUILTIN_AGENT_TARGET_DIRS[agentTarget as BuiltinAgentTarget];
  if (builtinDir) {
    return join(cwd, builtinDir, "skills");
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
