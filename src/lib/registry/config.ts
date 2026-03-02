const DEFAULT_REGISTRY_TIMEOUT_MS = 10_000;

export const REGISTRY_BY_PROJECT: Record<string, string> = {
  skillmarkdown: "https://registryapi-pfd5mx23uq-uc.a.run.app",
  "skillmarkdown-development": "https://registryapi-sm46rm3rja-uc.a.run.app",
};

export function parseRegistryTimeoutMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_REGISTRY_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("invalid SKILLMD_REGISTRY_TIMEOUT_MS; expected a positive integer");
  }

  return parsed;
}

export function resolveRegistryBaseUrl(projectId: string, envValue: string | undefined): string {
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
