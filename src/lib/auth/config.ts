import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import { DEFAULT_LOGIN_AUTH_CONFIG } from "./defaults";

export interface LoginEnvConfig {
  githubClientId: string;
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

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }
  try {
    return parseDotEnv(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function resolveRealPath(pathValue: string): string {
  const resolved = resolve(pathValue);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function firstNonEmpty(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function resolveDefaultProjectId(options: LoginConfigOptions = {}): string {
  const executionPath = options.executionPath ?? process.argv[1];
  if (!executionPath) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const scriptPath = resolveRealPath(executionPath);
  if (basename(scriptPath) !== CLI_SCRIPT_BASENAME) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const packageRoot = dirname(dirname(scriptPath));
  const packageJsonPath = join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  let packageName: string | undefined;
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
    packageName = typeof packageJson.name === "string" ? packageJson.name : undefined;
  } catch {
    packageName = undefined;
  }

  const isLocalCheckout =
    packageName === CLI_PACKAGE_NAME &&
    existsSync(join(packageRoot, "src")) &&
    existsSync(join(packageRoot, "tsconfig.json"));

  if (!isLocalCheckout) {
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
  const githubClientId = firstNonEmpty(
    env.SKILLMD_GITHUB_CLIENT_ID,
    dotEnv.SKILLMD_GITHUB_CLIENT_ID,
    DEFAULT_LOGIN_AUTH_CONFIG.githubClientId,
  );
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

  if (!githubClientId || !firebaseApiKey || !firebaseProjectId) {
    throw new Error("missing login configuration");
  }

  return { githubClientId, firebaseApiKey, firebaseProjectId };
}
