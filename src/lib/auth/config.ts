import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import { DEFAULT_LOGIN_AUTH_CONFIG } from "./defaults";

export interface LoginEnvConfig {
  githubClientId: string;
  firebaseApiKey: string;
  firebaseProjectId: string;
}

const USER_ENV_RELATIVE_PATH = ".skillmd/.env";

interface LoginConfigOptions {
  homeDir?: string;
  executionPath?: string;
  cwd?: string;
}

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

function resolveExecutionPath(executionPath: string): string {
  const resolved = resolve(executionPath);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function normalizePath(pathValue: string): string {
  const resolved = resolve(pathValue);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function readPackageName(packageJsonPath: string): string | undefined {
  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.name === "string" ? parsed.name : undefined;
  } catch {
    return undefined;
  }
}

function resolveDefaultProjectId(options: LoginConfigOptions = {}): string {
  const executionPath = options.executionPath ?? process.argv[1];
  if (!executionPath) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const scriptPath = resolveExecutionPath(executionPath);
  if (basename(scriptPath) !== CLI_SCRIPT_BASENAME) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const packageRoot = dirname(dirname(scriptPath));
  const packageJsonPath = join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const packageName = readPackageName(packageJsonPath);
  if (packageName !== CLI_PACKAGE_NAME) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const looksLikeLocalCheckout =
    existsSync(join(packageRoot, "src")) && existsSync(join(packageRoot, "tsconfig.json"));

  if (!looksLikeLocalCheckout) {
    return DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
  }

  const cwd = normalizePath(options.cwd ?? process.cwd());
  const normalizedPackageRoot = normalizePath(packageRoot);
  const isRunningInsideLocalCheckout =
    cwd === normalizedPackageRoot || cwd.startsWith(`${normalizedPackageRoot}${sep}`);

  return isRunningInsideLocalCheckout
    ? LOCAL_DEV_DEFAULT_PROJECT_ID
    : DEFAULT_LOGIN_AUTH_CONFIG.firebaseProjectId;
}

export function getLoginEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoginConfigOptions = {},
): LoginEnvConfig {
  const dotEnv = loadDotEnv(getDefaultUserEnvPath(options));
  const defaultProjectId = resolveDefaultProjectId(options);

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
    defaultProjectId,
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
