import { resolveConfiguredAuthToken } from "./api-token";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "./id-token";
import { readAuthSession, type AuthSession } from "./session";
import { getWhoami } from "../whoami/client";
import { type WhoamiResponse } from "../whoami/types";

interface WriteAuthConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

interface ResolveWriteAuthOptions {
  command: string;
  env?: NodeJS.ProcessEnv;
  config: WriteAuthConfig;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  getWhoami?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<WhoamiResponse>;
  requireOwner?: boolean;
  targetOwnerSlug?: string;
  ownerMismatchMessage?: (owner: string) => string;
}

interface ResolvedWriteAuth {
  idToken: string;
  owner: string | null;
}

type ResolveWriteAuthResult =
  | { ok: true; value: ResolvedWriteAuth }
  | {
      ok: false;
      message: string;
      reason?: "not_logged_in" | "project_mismatch" | "profile_missing";
      detail?: string;
      hint?: string;
    };

export async function resolveWriteAuth(
  options: ResolveWriteAuthOptions,
): Promise<ResolveWriteAuthResult> {
  const env = options.env ?? process.env;
  const configuredAuthToken = resolveConfiguredAuthToken(env);
  if (configuredAuthToken) {
    return { ok: true, value: { idToken: configuredAuthToken, owner: null } };
  }

  const session = (options.readSession ?? readAuthSession)();
  if (!session) {
    return {
      ok: false,
      message: `${options.command}: not logged in. Run 'skillmd login' first.`,
      reason: "not_logged_in",
      detail: "not logged in",
      hint: "Run 'skillmd login' first.",
    };
  }

  if (session.projectId && session.projectId !== options.config.firebaseProjectId) {
    const detail =
      `session project '${session.projectId}' does not match current config ` +
      `'${options.config.firebaseProjectId}'.`;
    const hint = "Run 'skillmd login --reauth' to switch projects.";
    return {
      ok: false,
      message: `${options.command}: ${detail} ${hint}`,
      reason: "project_mismatch",
      detail,
      hint,
    };
  }

  const exchangeRefreshTokenFn = options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken;
  const tokenSession = await exchangeRefreshTokenFn(
    options.config.firebaseApiKey,
    session.refreshToken,
  );

  let owner: string | null = null;
  if (options.requireOwner) {
    try {
      const profile = await (options.getWhoami ?? getWhoami)(
        options.config.registryBaseUrl,
        tokenSession.idToken,
        { timeoutMs: options.config.requestTimeoutMs },
      );
      owner = profile.owner;
    } catch {
      return {
        ok: false,
        message: `${options.command}: account profile not found. Complete sign-up on the web before using this command.`,
        reason: "profile_missing",
        detail: "account profile not found",
      };
    }
  }

  return { ok: true, value: { idToken: tokenSession.idToken, owner } };
}
