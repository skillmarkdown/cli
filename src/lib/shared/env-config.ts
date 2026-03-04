import { getLoginEnvConfig } from "../auth/config";
import { getRegistryEnvConfig } from "../registry/config";

interface AuthRegistryEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

interface RegistryEnvConfig {
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export function getAuthRegistryEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthRegistryEnvConfig {
  const loginConfig = getLoginEnvConfig(env);
  const registryConfig = getRegistryEnvConfig(env, {
    firebaseProjectId: loginConfig.firebaseProjectId,
  });

  return {
    firebaseApiKey: loginConfig.firebaseApiKey,
    firebaseProjectId: loginConfig.firebaseProjectId,
    registryBaseUrl: registryConfig.registryBaseUrl,
    requestTimeoutMs: registryConfig.requestTimeoutMs,
  };
}

export function getLoginScopedRegistryEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
): RegistryEnvConfig {
  const authRegistryConfig = getAuthRegistryEnvConfig(env);
  return {
    registryBaseUrl: authRegistryConfig.registryBaseUrl,
    requestTimeoutMs: authRegistryConfig.requestTimeoutMs,
  };
}
