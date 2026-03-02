import { getRegistryEnvConfig } from "../registry/config";
import { type ViewEnvConfig } from "./types";

export type { ViewEnvConfig } from "./types";

export function getViewEnvConfig(env: NodeJS.ProcessEnv = process.env): ViewEnvConfig {
  return getRegistryEnvConfig(env);
}
