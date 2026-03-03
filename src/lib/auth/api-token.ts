export const AUTH_TOKEN_ENV_VAR = "SKILLMD_AUTH_TOKEN";

export function resolveConfiguredAuthToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[AUTH_TOKEN_ENV_VAR];
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
