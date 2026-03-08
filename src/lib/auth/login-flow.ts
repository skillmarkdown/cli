import {
  type FirebaseEmailSignInResult,
  type FirebaseRefreshTokenValidationResult,
} from "./firebase-auth";
import { formatSessionProject } from "./login-status";
import { type LoginEnvConfig } from "./config";
import { type AuthSession } from "./session";

export interface LoginFlowDependencies {
  registryBaseUrl: string;
  requestTimeoutMs: number;
  readSession: () => AuthSession | null;
  writeSession: (session: AuthSession) => void;
  clearSession: () => boolean;
  promptForCredentials: () => Promise<{ username: string; password: string }>;
  resolveUsernameEmail: (
    baseUrl: string,
    username: string,
    options?: { timeoutMs?: number },
  ) => Promise<string>;
  signInWithEmailAndPassword: (
    apiKey: string,
    email: string,
    password: string,
  ) => Promise<FirebaseEmailSignInResult>;
  verifyRefreshToken: (
    apiKey: string,
    refreshToken: string,
  ) => Promise<FirebaseRefreshTokenValidationResult>;
}

export interface LoginFlowResult {
  exitCode: number;
  performedLogin: boolean;
}

export async function executeLoginFlow(
  config: LoginEnvConfig,
  reauth: boolean,
  dependencies: LoginFlowDependencies,
): Promise<LoginFlowResult> {
  const existingSession = dependencies.readSession();

  if (existingSession && !reauth) {
    try {
      const validation = await dependencies.verifyRefreshToken(
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

        return { exitCode: 0, performedLogin: false };
      }

      dependencies.clearSession();
      console.log("Existing session is no longer valid. Starting re-authentication.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `skillmd login: unable to verify existing session (${message}). ` +
          "Keeping current session. Run 'skillmd login --reauth' to force reauthentication.",
      );
      return { exitCode: 1, performedLogin: false };
    }
  }

  const { username, password } = await dependencies.promptForCredentials();
  const email = await dependencies.resolveUsernameEmail(dependencies.registryBaseUrl, username, {
    timeoutMs: dependencies.requestTimeoutMs,
  });
  const firebaseSession = await dependencies.signInWithEmailAndPassword(
    config.firebaseApiKey,
    email,
    password,
  );

  dependencies.writeSession({
    provider: "email",
    uid: firebaseSession.localId,
    email: firebaseSession.email ?? email,
    refreshToken: firebaseSession.refreshToken,
    projectId: config.firebaseProjectId,
  });

  console.log(
    `Login successful. Signed in as ${firebaseSession.email ?? email} (project: ${config.firebaseProjectId}).`,
  );

  return { exitCode: 0, performedLogin: true };
}
