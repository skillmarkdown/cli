import { getRegistryEnvConfig } from "../registry/config";
import { type SearchEnvConfig } from "./types";

export type { SearchEnvConfig } from "./types";

export function getSearchEnvConfig(env: NodeJS.ProcessEnv = process.env): SearchEnvConfig {
  return getRegistryEnvConfig(env);
}
