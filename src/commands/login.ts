import { LOGIN_USAGE } from "../lib/cli-text";
import { failWithUsage } from "../lib/command-output";
import { getLoginEnvConfig, type LoginEnvConfig } from "../lib/auth-config";
import { readAuthSession, writeAuthSession, type AuthSession } from "../lib/auth-session";
import {
  pollForAccessToken,
  requestDeviceCode,
  type DeviceCodeResponse,
  type GitHubAccessTokenResult,
} from "../lib/github-device-flow";
import { signInWithGitHubAccessToken, type FirebaseIdpResult } from "../lib/firebase-auth";

interface LoginCommandOptions {
  env?: NodeJS.ProcessEnv;
  readSession?: () => AuthSession | null;
  writeSession?: (session: AuthSession) => void;
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

function printSessionStatus(session: AuthSession | null): number {
  if (!session) {
    console.log("Not logged in.");
    return 1;
  }

  if (session.email) {
    console.log(`Logged in with GitHub as ${session.email}.`);
    return 0;
  }

  console.log(`Logged in with GitHub (uid: ${session.uid}).`);
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

  if (status) {
    return printSessionStatus(readSessionFn());
  }

  const existingSession = readSessionFn();
  if (existingSession && !reauth) {
    if (existingSession.email) {
      console.log(`Already logged in as ${existingSession.email}. Run 'skillmd logout' first.`);
    } else {
      console.log("Already logged in. Run 'skillmd logout' first.");
    }
    return 0;
  }

  try {
    const config = requireConfig(options.env ?? process.env);
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
    });

    if (firebaseSession.email) {
      console.log(`Login successful. Signed in as ${firebaseSession.email}.`);
    } else {
      console.log("Login successful.");
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd login: ${message}`);
    return 1;
  }
}
