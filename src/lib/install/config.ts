import { getUseEnvConfig, type UseEnvConfig } from "../use/config";

export type InstallEnvConfig = UseEnvConfig;

export function getInstallEnvConfig(env: NodeJS.ProcessEnv = process.env): InstallEnvConfig {
  return getUseEnvConfig(env);
}
