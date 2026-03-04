import { resolveConfiguredAuthToken } from "./api-token";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "./id-token";
import { deriveOwnerFromSession } from "./owner";
import { readAuthSession, type AuthSession } from "./session";

interface WriteAuthConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
}

interface ResolveWriteAuthOptions {
  command: string;
  env?: NodeJS.ProcessEnv;
  config: WriteAuthConfig;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
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
  | { ok: false; message: string };

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
    };
  }

  if (session.projectId && session.projectId !== options.config.firebaseProjectId) {
    return {
      ok: false,
      message:
        `${options.command}: session project '${session.projectId}' does not match current config ` +
        `'${options.config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
    };
  }

  const owner = deriveOwnerFromSession(session);
  if (options.requireOwner && !owner) {
    return {
      ok: false,
      message: `${options.command}: missing GitHub username in session. Run 'skillmd login --reauth' first.`,
    };
  }

  if (
    options.requireOwner &&
    owner &&
    options.targetOwnerSlug &&
    `@${options.targetOwnerSlug}` !== owner
  ) {
    return {
      ok: false,
      message: options.ownerMismatchMessage
        ? options.ownerMismatchMessage(owner)
        : `${options.command}: can only update skills owned by ${owner}.`,
    };
  }

  const exchangeRefreshTokenFn = options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken;
  const tokenSession = await exchangeRefreshTokenFn(
    options.config.firebaseApiKey,
    session.refreshToken,
  );
  return { ok: true, value: { idToken: tokenSession.idToken, owner } };
}
