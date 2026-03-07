import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import { DEFAULT_LOGIN_AUTH_CONFIG } from "./defaults";

export interface LoginEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
}

interface LoginConfigOptions {
  homeDir?: string;
  executionPath?: string;
  cwd?: string;
}

const USER_ENV_RELATIVE_PATH = ".skillmd/.env";
const LOCAL_DEV_DEFAULT_PROJECT_ID = "skillmarkdown-development";
const CLI_PACKAGE_NAME = "@skillmarkdown/cli";
const CLI_SCRIPT_BASENAME = "cli.js";

function parseDotEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      values[key] = value;
    }
  }
  return values;
}

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  return parseDotEnv(readFileSync(path, "utf8"));
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function resolveRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function resolvePackageRoot(executionPath: string): string | null {
  const normalizedExecutionPath = resolveRealPath(executionPath);
  const executionDir = dirname(normalizedExecutionPath);

  if (basename(normalizedExecutionPath) !== CLI_SCRIPT_BASENAME) {
    return null;
  }

  const packageRoot = dirname(executionDir);
  if (basename(packageRoot) !== CLI_PACKAGE_NAME.split("/").pop()) {
    return null;
  }

  return packageRoot;
}

function resolveDefaultProjectId(options: LoginConfigOptions = {}): string {
  const packageRoot = resolvePackageRoot(options.executionPath ?? process.argv[1] ?? "");
  if (!packageRoot) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const normalizedPackageRoot = resolveRealPath(packageRoot);
  const normalizedCwd = resolveRealPath(options.cwd ?? process.cwd());
  return normalizedCwd === normalizedPackageRoot ||
    normalizedCwd.startsWith(`${normalizedPackageRoot}${sep}`)
    ? LOCAL_DEV_DEFAULT_PROJECT_ID
    : DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
}

export function getDefaultUserEnvPath(options: LoginConfigOptions = {}): string {
  return join(options.homeDir ?? homedir(), USER_ENV_RELATIVE_PATH);
}

export function getLoginEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoginConfigOptions = {},
): LoginEnvConfig {
  const dotEnv = loadDotEnv(getDefaultUserEnvPath(options));
  const firebaseApiKey = firstNonEmpty(
    env.SKILLMD_FIREBASE_API_KEY,
    dotEnv.SKILLMD_FIREBASE_API_KEY,
    DEFAULT_LOGIN_AUTH_CONFIG.firebaseApiKey,
  );
  const firebaseProjectId = firstNonEmpty(
    env.SKILLMD_FIREBASE_PROJECT_ID,
    dotEnv.SKILLMD_FIREBASE_PROJECT_ID,
    resolveDefaultProjectId(options),
  );

  if (!firebaseApiKey || !firebaseProjectId) {
    throw new Error("missing login configuration");
  }

  return { firebaseApiKey, firebaseProjectId };
}
