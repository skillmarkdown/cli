import {
  type FirebaseEmailSignInResult,
  type FirebaseRefreshTokenValidationResult,
} from "./firebase-auth";
import { formatSessionProject } from "./login-status";
import { type LoginEnvConfig } from "./config";
import { type AuthSession } from "./session";

export interface LoginFlowDependencies {
  readSession: () => AuthSession | null;
  writeSession: (session: AuthSession) => void;
  clearSession: () => boolean;
  promptForCredentials: () => Promise<{ email: string; password: string }>;
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
    const project = formatSessionProject(existingSession, config.firebaseProjectId);
    if (project.mismatch) {
      console.error(
        `skillmd login: session project '${existingSession.projectId}' does not match current config ` +
          `'${config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
      );
      return { exitCode: 1, performedLogin: false };
    }

    try {
      const validation = await dependencies.verifyRefreshToken(
        config.firebaseApiKey,
        existingSession.refreshToken,
      );

      if (validation.valid) {
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

  const { email, password } = await dependencies.promptForCredentials();
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
