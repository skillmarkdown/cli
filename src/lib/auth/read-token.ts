import { getLoginEnvConfig } from "./config";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "./id-token";
import { readAuthSession, type AuthSession } from "./session";

interface ResolveReadTokenOptions {
  env?: NodeJS.ProcessEnv;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
}

const INVALID_SESSION_ERROR_PATTERNS = [
  /INVALID_REFRESH_TOKEN/u,
  /TOKEN_EXPIRED/u,
  /PROJECT_NUMBER_MISMATCH/u,
];

function isInvalidSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return INVALID_SESSION_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

export async function resolveReadIdToken(
  options: ResolveReadTokenOptions = {},
): Promise<string | null> {
  const session = (options.readSession ?? readAuthSession)();
  if (!session) {
    return null;
  }

  const config = getLoginEnvConfig(options.env ?? process.env);

  if (session.projectId && session.projectId !== config.firebaseProjectId) {
    return null;
  }

  try {
    const tokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
      config.firebaseApiKey,
      session.refreshToken,
    );
    return tokenSession.idToken;
  } catch (error) {
    if (isInvalidSessionError(error)) {
      return null;
    }

    const message = error instanceof Error ? error.message : "unknown token exchange error";
    const wrapped = new Error(`unable to resolve read token: ${message}`) as Error & {
      cause?: unknown;
    };
    wrapped.cause = error;
    throw wrapped;
  }
}
