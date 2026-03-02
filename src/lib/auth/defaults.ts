export interface DefaultLoginAuthConfig {
  githubClientId: string;
  firebaseApiKey: string;
  firebaseProjectId: string;
}

// Single source of truth for built-in auth defaults.
export const DEFAULT_LOGIN_AUTH_CONFIG: DefaultLoginAuthConfig = Object.freeze({
  githubClientId: "Ov23lixkdtyLp35IFaBG",
  firebaseApiKey: "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok",
  firebaseProjectId: "skillmarkdown",
});
