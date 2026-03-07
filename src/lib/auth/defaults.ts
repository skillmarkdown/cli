export interface DefaultLoginAuthConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
}

export const PRODUCTION_LOGIN_AUTH_CONFIG: DefaultLoginAuthConfig = Object.freeze({
  firebaseApiKey: "AIzaSyAkaZRmpCvZasFjeRAfW_b0V0nUcGOTjok",
  firebaseProjectId: "skillmarkdown",
});

export const DEVELOPMENT_LOGIN_AUTH_CONFIG: DefaultLoginAuthConfig = Object.freeze({
  firebaseApiKey: "AIzaSyB1eLZYLzmkrEdXXT6aZKB7sIWkTvKzf6M",
  firebaseProjectId: "skillmarkdown-development",
});

export const DEFAULT_LOGIN_AUTH_CONFIG = PRODUCTION_LOGIN_AUTH_CONFIG;
