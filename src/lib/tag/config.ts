import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";
import { type TagEnvConfig } from "./types";

export function getTagEnvConfig(env: NodeJS.ProcessEnv = process.env): TagEnvConfig {
  const loginConfig = getLoginEnvConfig(env);
  const registryConfig = getRegistryEnvConfig(env, {
    firebaseProjectId: loginConfig.firebaseProjectId,
  });

  return {
    firebaseApiKey: loginConfig.firebaseApiKey,
    firebaseProjectId: loginConfig.firebaseProjectId,
    registryBaseUrl: registryConfig.registryBaseUrl,
    requestTimeoutMs: registryConfig.requestTimeoutMs,
  };
}
