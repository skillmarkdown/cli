import { getLoginEnvConfig } from "../auth/config";
import { parseRegistryTimeoutMs, resolveRegistryBaseUrl } from "../registry/config";
import { type HistoryEnvConfig } from "./types";

export type { HistoryEnvConfig } from "./types";

export function getHistoryEnvConfig(env: NodeJS.ProcessEnv = process.env): HistoryEnvConfig {
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
