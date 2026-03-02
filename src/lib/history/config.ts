import { getRegistryEnvConfig } from "../registry/config";
import { type HistoryEnvConfig } from "./types";

export type { HistoryEnvConfig } from "./types";

export function getHistoryEnvConfig(env: NodeJS.ProcessEnv = process.env): HistoryEnvConfig {
  return getRegistryEnvConfig(env);
}
