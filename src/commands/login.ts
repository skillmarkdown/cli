import { LOGIN_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";

import { getLoginEnvConfig, type LoginEnvConfig } from "../lib/auth/config";
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
  type AuthSession,
} from "../lib/auth/session";
import {
  pollForAccessToken,
  requestGitHubUsername,
  requestDeviceCode,
  type DeviceCodeResponse,
  type GitHubAccessTokenResult,
} from "../lib/auth/github-device-flow";
import {
  signInWithGitHubAccessToken,
  type FirebaseIdpResult,
  verifyFirebaseRefreshToken,
  type FirebaseRefreshTokenValidationResult,
} from "../lib/auth/firebase-auth";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { executeLoginFlow } from "../lib/auth/login-flow";
import { parseLoginFlags } from "../lib/auth/login-flags";
import { printSessionStatus } from "../lib/auth/login-status";
import { bootstrapOwner as defaultBootstrapOwner } from "../lib/auth/bootstrap-owner";
import { getRegistryEnvConfig } from "../lib/registry/config";

interface LoginCommandOptions {
  env?: NodeJS.ProcessEnv;
  readSession?: () => AuthSession | null;
  writeSession?: (session: AuthSession) => void;
  clearSession?: () => boolean;
  requestDeviceCode?: (clientId: string, scope?: string) => Promise<DeviceCodeResponse>;
  pollForAccessToken?: (
    clientId: string,
    deviceCode: string,
    intervalSeconds: number,
    expiresInSeconds: number,
  ) => Promise<GitHubAccessTokenResult>;
  signInWithGitHubAccessToken?: (
    apiKey: string,
    githubAccessToken: string,
  ) => Promise<FirebaseIdpResult>;
  resolveGitHubUsername?: (githubAccessToken: string) => Promise<string>;
  verifyRefreshToken?: (
    apiKey: string,
    refreshToken: string,
  ) => Promise<FirebaseRefreshTokenValidationResult>;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  bootstrapOwner?: (
    baseUrl: string,
    idToken: string,
    request: { ownerLogin: string },
    options?: { timeoutMs?: number },
  ) => Promise<{ status: string }>;
}

function requireConfig(env: NodeJS.ProcessEnv): LoginEnvConfig {
  try {
    return getLoginEnvConfig(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid login configuration";
    const wrapped = new Error(`${message}.`) as Error & { cause?: unknown };
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function runLoginCommand(
  args: string[],
  options: LoginCommandOptions = {},
): Promise<number> {
  const { status, reauth, valid } = parseLoginFlags(args);
  if (!valid) {
    return failWithUsage("skillmd login: unsupported argument(s)", LOGIN_USAGE);
  }

  const readSessionFn = options.readSession ?? readAuthSession;
  const writeSessionFn = options.writeSession ?? writeAuthSession;
  const clearSessionFn = options.clearSession ?? clearAuthSession;

  try {
    const config = requireConfig(options.env ?? process.env);
    if (status) {
      return printSessionStatus(readSessionFn(), config.firebaseProjectId);
    }

    const result = await executeLoginFlow(config, reauth, {
      readSession: readSessionFn,
      writeSession: writeSessionFn,
      clearSession: clearSessionFn,
      requestDeviceCode: options.requestDeviceCode ?? requestDeviceCode,
      pollForAccessToken: options.pollForAccessToken ?? pollForAccessToken,
      signInWithGitHubAccessToken:
        options.signInWithGitHubAccessToken ?? signInWithGitHubAccessToken,
      resolveGitHubUsername: options.resolveGitHubUsername ?? requestGitHubUsername,
      verifyRefreshToken: options.verifyRefreshToken ?? verifyFirebaseRefreshToken,
    });
    if (result !== 0 || status) {
      return result;
    }

    // Best-effort owner bootstrap after successful login to recover cleanly after dev resets.
    const session = readSessionFn();
    const ownerLogin = session?.githubUsername?.trim();
    if (!session?.refreshToken || !ownerLogin) {
      return result;
    }

    try {
      const registryConfig = getRegistryEnvConfig(options.env ?? process.env, {
        firebaseProjectId: config.firebaseProjectId,
      });
      const tokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
        config.firebaseApiKey,
        session.refreshToken,
      );
      await (options.bootstrapOwner ?? defaultBootstrapOwner)(
        registryConfig.registryBaseUrl,
        tokenSession.idToken,
        { ownerLogin },
        { timeoutMs: registryConfig.requestTimeoutMs },
      );
    } catch (bootstrapError) {
      const message =
        bootstrapError instanceof Error ? bootstrapError.message : "unknown bootstrap error";
      console.warn(`skillmd login: owner bootstrap skipped (${message}).`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd login: ${message}`);
    return 1;
  }
}
