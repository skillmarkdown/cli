import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";
import { type UnpublishEnvConfig } from "./types";

export function getUnpublishEnvConfig(env: NodeJS.ProcessEnv = process.env): UnpublishEnvConfig {
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
