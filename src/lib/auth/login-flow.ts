import { type LoginEnvConfig } from "./config";
import { type AuthSession } from "./session";
import { type DeviceCodeResponse, type GitHubAccessTokenResult } from "./github-device-flow";
import { type FirebaseIdpResult, type FirebaseRefreshTokenValidationResult } from "./firebase-auth";
import { formatSessionProject } from "./login-status";

export interface LoginFlowDependencies {
  readSession: () => AuthSession | null;
  writeSession: (session: AuthSession) => void;
  clearSession: () => boolean;
  requestDeviceCode: (clientId: string, scope?: string) => Promise<DeviceCodeResponse>;
  pollForAccessToken: (
    clientId: string,
    deviceCode: string,
    intervalSeconds: number,
    expiresInSeconds: number,
  ) => Promise<GitHubAccessTokenResult>;
  signInWithGitHubAccessToken: (
    apiKey: string,
    githubAccessToken: string,
  ) => Promise<FirebaseIdpResult>;
  verifyRefreshToken: (
    apiKey: string,
    refreshToken: string,
  ) => Promise<FirebaseRefreshTokenValidationResult>;
}

export async function executeLoginFlow(
  config: LoginEnvConfig,
  reauth: boolean,
  dependencies: LoginFlowDependencies,
): Promise<number> {
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

        return 0;
      }

      dependencies.clearSession();
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

  const deviceCode = await dependencies.requestDeviceCode(config.githubClientId);
  console.log("Open this URL in your browser to authorize skillmd:");
  console.log(deviceCode.verificationUriComplete ?? deviceCode.verificationUri);
  console.log(`Then enter code: ${deviceCode.userCode}`);

  const token = await dependencies.pollForAccessToken(
    config.githubClientId,
    deviceCode.deviceCode,
    deviceCode.interval,
    deviceCode.expiresIn,
  );

  const firebaseSession = await dependencies.signInWithGitHubAccessToken(
    config.firebaseApiKey,
    token.accessToken,
  );

  dependencies.writeSession({
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
}
