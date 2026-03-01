import { getLoginEnvConfig } from "../auth/config";
import { type PublishEnvConfig } from "./types";

const DEFAULT_REGISTRY_TIMEOUT_MS = 10_000;
const REGISTRY_BY_PROJECT: Record<string, string> = {
  skillmarkdown: "https://registry.skillmarkdown.com",
  "skillmarkdown-development": "https://registry-development.skillmarkdown.com",
};

function parseTimeoutMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_REGISTRY_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("invalid SKILLMD_REGISTRY_TIMEOUT_MS; expected a positive integer");
  }

  return parsed;
}

function resolveRegistryBaseUrl(projectId: string, envValue: string | undefined): string {
  const candidate = envValue?.trim() || REGISTRY_BY_PROJECT[projectId];
  if (!candidate) {
    throw new Error(
      `missing registry base URL for project '${projectId}'. Set SKILLMD_REGISTRY_BASE_URL.`,
    );
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`invalid registry base URL: ${candidate}`);
  }
}

export function getPublishEnvConfig(env: NodeJS.ProcessEnv = process.env): PublishEnvConfig {
  const loginConfig = getLoginEnvConfig(env);

  return {
    firebaseApiKey: loginConfig.firebaseApiKey,
    firebaseProjectId: loginConfig.firebaseProjectId,
    registryBaseUrl: resolveRegistryBaseUrl(
      loginConfig.firebaseProjectId,
      env.SKILLMD_REGISTRY_BASE_URL,
    ),
    requestTimeoutMs: parseTimeoutMs(env.SKILLMD_REGISTRY_TIMEOUT_MS),
  };
}
