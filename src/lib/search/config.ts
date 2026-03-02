import { getLoginEnvConfig } from "../auth/config";
import { parseRegistryTimeoutMs, resolveRegistryBaseUrl } from "../registry/config";
import { type SearchEnvConfig } from "./types";

export type { SearchEnvConfig } from "./types";

export function getSearchEnvConfig(env: NodeJS.ProcessEnv = process.env): SearchEnvConfig {
  const loginConfig = getLoginEnvConfig(env);

  return {
    firebaseProjectId: loginConfig.firebaseProjectId,
    registryBaseUrl: resolveRegistryBaseUrl(
      loginConfig.firebaseProjectId,
      env.SKILLMD_REGISTRY_BASE_URL,
    ),
    requestTimeoutMs: parseRegistryTimeoutMs(env.SKILLMD_REGISTRY_TIMEOUT_MS),
  };
}
