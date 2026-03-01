import { LOGIN_USAGE } from "../lib/cli-text";
import { failWithUsage } from "../lib/command-output";
import { getLoginEnvConfig, type LoginEnvConfig } from "../lib/auth-config";
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
  type AuthSession,
} from "../lib/auth-session";
import {
  pollForAccessToken,
  requestDeviceCode,
  type DeviceCodeResponse,
  type GitHubAccessTokenResult,
} from "../lib/github-device-flow";
import {
  signInWithGitHubAccessToken,
  type FirebaseIdpResult,
  verifyFirebaseRefreshToken,
  type FirebaseRefreshTokenValidationResult,
} from "../lib/firebase-auth";

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
  verifyRefreshToken?: (
    apiKey: string,
    refreshToken: string,
  ) => Promise<FirebaseRefreshTokenValidationResult>;
}

function parseFlags(args: string[]): { status: boolean; reauth: boolean; valid: boolean } {
  let status = false;
  let reauth = false;

  for (const arg of args) {
    if (arg === "--status") {
      status = true;
      continue;
    }
    if (arg === "--reauth") {
      reauth = true;
      continue;
    }
    return { status: false, reauth: false, valid: false };
  }

  if (status && reauth) {
    return { status: false, reauth: false, valid: false };
  }

  return { status, reauth, valid: true };
}

function formatSessionProject(
  session: AuthSession,
  currentConfigProjectId?: string,
): { label: string; mismatch: boolean } {
  if (!session.projectId) {
    if (currentConfigProjectId) {
      return { label: `unknown (current config: ${currentConfigProjectId})`, mismatch: false };
    }
    return { label: "unknown", mismatch: false };
  }

  return {
    label: session.projectId,
    mismatch: Boolean(currentConfigProjectId && session.projectId !== currentConfigProjectId),
  };
}

function printSessionStatus(session: AuthSession | null, currentConfigProjectId?: string): number {
  if (!session) {
    console.log("Not logged in.");
    return 1;
  }

  const project = formatSessionProject(session, currentConfigProjectId);

  if (session.email) {
    console.log(`Logged in with GitHub as ${session.email} (project: ${project.label}).`);
  } else {
    console.log(`Logged in with GitHub (uid: ${session.uid}, project: ${project.label}).`);
  }

  if (project.mismatch && currentConfigProjectId) {
    console.log(
      `Current CLI config targets project '${currentConfigProjectId}'. ` +
        "Run 'skillmd login --reauth' to switch projects.",
    );
  }

  return 0;
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
  const { status, reauth, valid } = parseFlags(args);
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

    const existingSession = readSessionFn();
    if (existingSession && !reauth) {
      const verifyRefreshTokenFn = options.verifyRefreshToken ?? verifyFirebaseRefreshToken;

      try {
        const validation = await verifyRefreshTokenFn(
          config.firebaseApiKey,
          existingSession.refreshToken,
        );

        if (validation.valid) {
          const project = formatSessionProject(existingSession, config.firebaseProjectId);
          if (existingSession.email) {
            console.log(
              `Already logged in as ${existingSession.email} (project: ${project.label}). ` +
                "Run 'skillmd logout' first.",
            );
          } else {
            console.log(
              `Already logged in (uid: ${existingSession.uid}, project: ${project.label}). ` +
                "Run 'skillmd logout' first.",
            );
          }
          if (project.mismatch) {
            console.log(
              `Current CLI config targets project '${config.firebaseProjectId}'. ` +
                "Run 'skillmd login --reauth' to switch projects.",
            );
          }
          return 0;
        }

        clearSessionFn();
        console.log("Existing session is no longer valid. Starting re-authentication.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(
          `skillmd login: unable to verify existing session (${message}). ` +
            "Keeping current session. Run 'skillmd login --reauth' to force reauthentication.",
        );
        return 1;
      }
    }

    const requestDeviceCodeFn = options.requestDeviceCode ?? requestDeviceCode;
    const pollForAccessTokenFn = options.pollForAccessToken ?? pollForAccessToken;
    const signInFn = options.signInWithGitHubAccessToken ?? signInWithGitHubAccessToken;

    const deviceCode = await requestDeviceCodeFn(config.githubClientId);
    console.log("Open this URL in your browser to authorize skillmd:");
    console.log(deviceCode.verificationUriComplete ?? deviceCode.verificationUri);
    console.log(`Then enter code: ${deviceCode.userCode}`);

    const token = await pollForAccessTokenFn(
      config.githubClientId,
      deviceCode.deviceCode,
      deviceCode.interval,
      deviceCode.expiresIn,
    );

    const firebaseSession = await signInFn(config.firebaseApiKey, token.accessToken);
    writeSessionFn({
      provider: "github",
      uid: firebaseSession.localId,
      email: firebaseSession.email,
      refreshToken: firebaseSession.refreshToken,
      projectId: config.firebaseProjectId,
    });

    if (firebaseSession.email) {
      console.log(
        `Login successful. Signed in as ${firebaseSession.email} (project: ${config.firebaseProjectId}).`,
      );
    } else {
      console.log(`Login successful (project: ${config.firebaseProjectId}).`);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd login: ${message}`);
    return 1;
  }
}
