import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";
import { type DeprecateEnvConfig } from "./types";

export function getDeprecateEnvConfig(env: NodeJS.ProcessEnv = process.env): DeprecateEnvConfig {
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
