import { getLoginEnvConfig } from "../auth/config";
import { parseRegistryTimeoutMs, resolveRegistryBaseUrl } from "../registry/config";
import { type UseEnvConfig } from "./types";

export type { UseEnvConfig } from "./types";

export function getUseEnvConfig(env: NodeJS.ProcessEnv = process.env): UseEnvConfig {
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
