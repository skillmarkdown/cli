import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";
import { resolveDefaultAgentTarget } from "../shared/agent-target";
import { type PublishEnvConfig } from "./types";

export function getPublishEnvConfig(env: NodeJS.ProcessEnv = process.env): PublishEnvConfig {
  const loginConfig = getLoginEnvConfig(env);
  const registryConfig = getRegistryEnvConfig(env, {
    firebaseProjectId: loginConfig.firebaseProjectId,
  });

  return {
    firebaseApiKey: loginConfig.firebaseApiKey,
    ...registryConfig,
    defaultAgentTarget: resolveDefaultAgentTarget(env.SKILLMD_AGENT_TARGET),
  };
}
