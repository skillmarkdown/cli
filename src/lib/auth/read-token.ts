import { getLoginEnvConfig } from "./config";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "./id-token";
import { readAuthSession, type AuthSession } from "./session";

interface ResolveReadTokenOptions {
  env?: NodeJS.ProcessEnv;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
}

export async function resolveReadIdToken(
  options: ResolveReadTokenOptions = {},
): Promise<string | null> {
  const session = (options.readSession ?? readAuthSession)();
  if (!session) {
    return null;
  }

  let config;
  try {
    config = getLoginEnvConfig(options.env ?? process.env);
  } catch {
    return null;
  }

  if (session.projectId && session.projectId !== config.firebaseProjectId) {
    return null;
  }

  try {
    const tokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
      config.firebaseApiKey,
      session.refreshToken,
    );
    return tokenSession.idToken;
  } catch {
    return null;
  }
}
