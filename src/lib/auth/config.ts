import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_LOGIN_AUTH_CONFIG } from "./defaults";

export interface LoginEnvConfig {
  githubClientId: string;
  firebaseApiKey: string;
  firebaseProjectId: string;
}

const USER_ENV_RELATIVE_PATH = ".skillmd/.env";

interface LoginConfigOptions {
  homeDir?: string;
}

function parseDotEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    if (!key) {
      continue;
    }

    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadDotEnv(dotEnvPath: string): Record<string, string> {
  if (!existsSync(dotEnvPath)) {
    return {};
  }

  try {
    return parseDotEnv(readFileSync(dotEnvPath, "utf8"));
  } catch {
    return {};
  }
}

function pickValue(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

export function getLoginEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoginConfigOptions = {},
): LoginEnvConfig {
  const dotEnv = loadDotEnv(getDefaultUserEnvPath(options));

  const githubClientId = pickValue(
    env.SKILLMD_GITHUB_CLIENT_ID,
    dotEnv.SKILLMD_GITHUB_CLIENT_ID,
    DEFAULT_LOGIN_AUTH_CONFIG.githubClientId,
  );
  const firebaseApiKey = pickValue(
    env.SKILLMD_FIREBASE_API_KEY,
    dotEnv.SKILLMD_FIREBASE_API_KEY,
    DEFAULT_LOGIN_AUTH_CONFIG.firebaseApiKey,
  );
  const firebaseProjectId = pickValue(
    env.SKILLMD_FIREBASE_PROJECT_ID,
    dotEnv.SKILLMD_FIREBASE_PROJECT_ID,
    DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId,
  );

  if (!githubClientId || !firebaseApiKey || !firebaseProjectId) {
    throw new Error("missing login configuration");
  }

  return {
    githubClientId,
    firebaseApiKey,
    firebaseProjectId,
  };
}

export function getDefaultUserEnvPath(options: LoginConfigOptions = {}): string {
  return join(options.homeDir ?? homedir(), USER_ENV_RELATIVE_PATH);
}
