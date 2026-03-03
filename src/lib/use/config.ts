import { getRegistryEnvConfig } from "../registry/config";
import { resolveDefaultAgentTarget } from "../shared/agent-target";
import { type UseEnvConfig } from "./types";

export type { UseEnvConfig } from "./types";

export function getUseEnvConfig(env: NodeJS.ProcessEnv = process.env): UseEnvConfig {
  const registry = getRegistryEnvConfig(env);
  return {
    ...registry,
    defaultAgentTarget: resolveDefaultAgentTarget(env.SKILLMD_AGENT_TARGET),
  };
}
