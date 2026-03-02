import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";
import { type PublishEnvConfig } from "./types";

export function getPublishEnvConfig(env: NodeJS.ProcessEnv = process.env): PublishEnvConfig {
  const loginConfig = getLoginEnvConfig(env);
  const registryConfig = getRegistryEnvConfig(env, {
    firebaseProjectId: loginConfig.firebaseProjectId,
  });

  return {
    firebaseApiKey: loginConfig.firebaseApiKey,
    ...registryConfig,
  };
}
