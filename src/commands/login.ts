import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
  signInWithEmailAndPassword,
  verifyFirebaseRefreshToken,
  type FirebaseEmailSignInResult,
  type FirebaseRefreshTokenValidationResult,
} from "../lib/auth/firebase-auth";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { executeLoginFlow } from "../lib/auth/login-flow";
import { parseLoginFlags } from "../lib/auth/login-flags";
import { printSessionStatus } from "../lib/auth/login-status";
import { getWhoami as defaultGetWhoami } from "../lib/whoami/client";
import { getRegistryEnvConfig } from "../lib/registry/config";
import { type WhoamiResponse } from "../lib/whoami/types";

interface LoginCommandOptions {
  env?: NodeJS.ProcessEnv;
  readSession?: () => AuthSession | null;
  writeSession?: (session: AuthSession) => void;
  clearSession?: () => boolean;
  promptForCredentials?: () => Promise<{ email: string; password: string }>;
  signInWithEmailAndPassword?: (
    apiKey: string,
    email: string,
    password: string,
  ) => Promise<FirebaseEmailSignInResult>;
  verifyRefreshToken?: (
    apiKey: string,
    refreshToken: string,
  ) => Promise<FirebaseRefreshTokenValidationResult>;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  getWhoami?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<WhoamiResponse>;
}

function promptCredentialsFromEnv(
  env: NodeJS.ProcessEnv,
): { email: string; password: string } | null {
  const email = env.SKILLMD_LOGIN_EMAIL?.trim();
  const password = env.SKILLMD_LOGIN_PASSWORD?.trim();
  if (!email && !password) {
    return null;
  }
  if (!email || !password) {
    throw new Error(
      "non-interactive login requires both SKILLMD_LOGIN_EMAIL and SKILLMD_LOGIN_PASSWORD",
    );
  }
  return { email, password };
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

function promptForHiddenPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!input.isTTY || !output.isTTY) {
      reject(new Error("interactive password entry requires a TTY"));
      return;
    }

    output.write(prompt);
    const previousRawMode = input.isRaw ?? false;
    let password = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(previousRawMode);
      input.pause();
    };

    const finish = () => {
      output.write("\n");
      cleanup();
      resolve(password.trim());
    };

    const fail = (error: Error) => {
      output.write("\n");
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      for (const char of value) {
        if (char === "\u0003") {
          fail(new Error("login cancelled"));
          return;
        }
        if (char == "\r" || char == "\n") {
          finish();
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          continue;
        }
        password += char;
      }
    };

    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function promptForCredentials(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ email: string; password: string }> {
  const envCredentials = promptCredentialsFromEnv(env);
  if (envCredentials) {
    return envCredentials;
  }

  const rl = createInterface({ input, output });
  try {
    const email = (await rl.question("Email: ")).trim();
    rl.close();

    const password = await promptForHiddenPassword("Password: ");

    if (!email || !password) {
      throw new Error("email and password are required");
    }

    return { email, password };
  } catch (error) {
    rl.close();
    throw error;
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

  const env = options.env ?? process.env;
  const readSessionFn = options.readSession ?? readAuthSession;
  const writeSessionFn = options.writeSession ?? writeAuthSession;
  const clearSessionFn = options.clearSession ?? clearAuthSession;

  try {
    const config = requireConfig(env);
    if (status) {
      return printSessionStatus(readSessionFn(), config.firebaseProjectId);
    }

    const registryConfig = getRegistryEnvConfig(env, {
      firebaseProjectId: config.firebaseProjectId,
    });

    const loginResult = await executeLoginFlow(config, reauth, {
      readSession: readSessionFn,
      writeSession: writeSessionFn,
      clearSession: clearSessionFn,
      promptForCredentials: options.promptForCredentials ?? (() => promptForCredentials(env)),
      signInWithEmailAndPassword: options.signInWithEmailAndPassword ?? signInWithEmailAndPassword,
      verifyRefreshToken: options.verifyRefreshToken ?? verifyFirebaseRefreshToken,
    });
    if (loginResult.exitCode !== 0) {
      return loginResult.exitCode;
    }
    if (!loginResult.performedLogin) {
      return loginResult.exitCode;
    }

    const session = readSessionFn();
    if (!session?.refreshToken) {
      return loginResult.exitCode;
    }

    const tokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
      config.firebaseApiKey,
      session.refreshToken,
    );

    try {
      await (options.getWhoami ?? defaultGetWhoami)(
        registryConfig.registryBaseUrl,
        tokenSession.idToken,
        { timeoutMs: registryConfig.requestTimeoutMs },
      );
    } catch (error) {
      clearSessionFn();
      const message = error instanceof Error ? error.message : "account profile not found";
      console.error(`skillmd login: ${message}. Complete sign-up on the web before using the CLI.`);
      return 1;
    }

    return loginResult.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd login: ${message}`);
    return 1;
  }
}
