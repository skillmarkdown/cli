import { homedir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_AGENT_TARGET,
  parseCustomAgentSlug,
  type AgentTarget,
  type BuiltinAgentTarget,
} from "../shared/agent-target";

const LEGACY_REGISTRY_HOST = "registry.skillmarkdown.com";

export type InstallScope = "workspace" | "global";

type PathingOptions = {
  scope?: InstallScope;
  homeDir?: string;
};

const WORKSPACE_BUILTIN_AGENT_TARGET_DIRS: Record<BuiltinAgentTarget, string> = {
  skillmd: ".agent",
  openai: ".openai",
  claude: ".claude",
  gemini: ".gemini",
  meta: ".meta",
  mistral: ".mistral",
  deepseek: ".deepseek",
  perplexity: ".perplexity",
};

const GLOBAL_BUILTIN_AGENT_TARGET_DIRS: Record<BuiltinAgentTarget, string> = {
  skillmd: ".agent",
  openai: ".codex",
  claude: ".claude",
  gemini: ".gemini",
  meta: ".meta",
  mistral: ".mistral",
  deepseek: ".deepseek",
  perplexity: ".perplexity",
};

const GLOBAL_KNOWN_ALIAS_DIRS = new Map<string, string>([
  ["custom:openai", ".codex"],
  ["custom:chatgpt", ".codex"],
  ["custom:claude", ".claude"],
  ["custom:anthropic", ".claude"],
  ["custom:gemini", ".gemini"],
  ["custom:google", ".gemini"],
  ["custom:meta", ".meta"],
  ["custom:llama", ".meta"],
  ["custom:mistral", ".mistral"],
  ["custom:deepseek", ".deepseek"],
  ["custom:perplexity", ".perplexity"],
]);

export function resolveRegistryHost(baseUrl: string): string {
  void baseUrl;
  return LEGACY_REGISTRY_HOST;
}

function resolveScopeRoot(cwd: string, options: PathingOptions = {}): string {
  if (options.scope === "global") {
    return options.homeDir ?? homedir();
  }

  return cwd;
}

function resolveBuiltinDir(agentTarget: BuiltinAgentTarget, scope: InstallScope): string {
  return scope === "global"
    ? GLOBAL_BUILTIN_AGENT_TARGET_DIRS[agentTarget]
    : WORKSPACE_BUILTIN_AGENT_TARGET_DIRS[agentTarget];
}

function resolveKnownAliasDir(agentTarget: AgentTarget, scope: InstallScope): string | undefined {
  if (scope !== "global") {
    return undefined;
  }

  return GLOBAL_KNOWN_ALIAS_DIRS.get(agentTarget);
}

function resolveSkillsTargetRoot(
  cwd: string,
  agentTarget: AgentTarget,
  options: PathingOptions = {},
): string {
  const scope = options.scope ?? "workspace";
  const scopeRoot = resolveScopeRoot(cwd, options);
  const builtinDir = resolveBuiltinDir(agentTarget as BuiltinAgentTarget, scope);
  if (builtinDir) {
    return join(scopeRoot, builtinDir, "skills");
  }

  const aliasDir = resolveKnownAliasDir(agentTarget, scope);
  if (aliasDir) {
    return join(scopeRoot, aliasDir, "skills");
  }

  const slug = parseCustomAgentSlug(agentTarget);
  if (!slug) {
    return join(scopeRoot, ".agent", "skills");
  }

  return join(scopeRoot, ".agents", "skills", slug);
}

export function resolveInstalledSkillPath(
  cwd: string,
  registryBaseUrl: string,
  username: string,
  skillSlug: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
  options: PathingOptions = {},
): string {
  return join(
    resolveInstalledSkillsHostRoot(cwd, registryBaseUrl, agentTarget, options),
    username,
    skillSlug,
  );
}

export function resolveLegacyInstalledSkillPath(
  cwd: string,
  registryBaseUrl: string,
  username: string,
  skillSlug: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
  options: PathingOptions = {},
): string {
  return join(
    resolveLegacyInstalledSkillsHostRoot(cwd, registryBaseUrl, agentTarget, options),
    username,
    skillSlug,
  );
}

export function resolveInstallTempRoot(
  cwd: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
  options: PathingOptions = {},
): string {
  const scope = options.scope ?? "workspace";
  const scopeRoot = resolveScopeRoot(cwd, options);
  const builtinDir = resolveBuiltinDir(agentTarget as BuiltinAgentTarget, scope);
  if (builtinDir) {
    return join(scopeRoot, builtinDir, ".tmp");
  }

  const aliasDir = resolveKnownAliasDir(agentTarget, scope);
  if (aliasDir) {
    return join(scopeRoot, aliasDir, ".tmp");
  }

  const slug = parseCustomAgentSlug(agentTarget);
  if (!slug) {
    return join(scopeRoot, ".agent", ".tmp");
  }

  return join(scopeRoot, ".agents", ".tmp", slug);
}

export function resolveInstalledSkillsHostRoot(
  cwd: string,
  registryBaseUrl: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
  options: PathingOptions = {},
): string {
  void registryBaseUrl;
  return resolveSkillsTargetRoot(cwd, agentTarget, options);
}

export function resolveLegacyInstalledSkillsHostRoot(
  cwd: string,
  registryBaseUrl: string,
  agentTarget: AgentTarget = DEFAULT_AGENT_TARGET,
  options: PathingOptions = {},
): string {
  return join(
    resolveSkillsTargetRoot(cwd, agentTarget, options),
    resolveRegistryHost(registryBaseUrl),
  );
}
