import { getLoginEnvConfig } from "../auth/config";
import { parseRegistryTimeoutMs, resolveRegistryBaseUrl } from "../registry/config";
import { type ViewEnvConfig } from "./types";

export type { ViewEnvConfig } from "./types";

export function getViewEnvConfig(env: NodeJS.ProcessEnv = process.env): ViewEnvConfig {
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
