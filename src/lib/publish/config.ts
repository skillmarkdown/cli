import { resolveDefaultAgentTarget } from "../shared/agent-target";
import { getAuthRegistryEnvConfig } from "../shared/env-config";
import { type PublishEnvConfig } from "./types";

export function getPublishEnvConfig(env: NodeJS.ProcessEnv = process.env): PublishEnvConfig {
  const config = getAuthRegistryEnvConfig(env);

  return {
    ...config,
    defaultAgentTarget: resolveDefaultAgentTarget(env.SKILLMD_AGENT_TARGET),
  };
}
