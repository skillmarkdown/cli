import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";
import { type WhoamiEnvConfig } from "./types";

export function getWhoamiEnvConfig(env: NodeJS.ProcessEnv = process.env): WhoamiEnvConfig {
  const loginConfig = getLoginEnvConfig(env);
  const registryConfig = getRegistryEnvConfig(env, {
    firebaseProjectId: loginConfig.firebaseProjectId,
  });

  return {
    registryBaseUrl: registryConfig.registryBaseUrl,
    requestTimeoutMs: registryConfig.requestTimeoutMs,
  };
}
