import { getRegistryEnvConfig } from "../registry/config";
import { type UseEnvConfig } from "./types";

export type { UseEnvConfig } from "./types";

export function getUseEnvConfig(env: NodeJS.ProcessEnv = process.env): UseEnvConfig {
  return getRegistryEnvConfig(env);
}
