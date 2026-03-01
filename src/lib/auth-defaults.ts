export interface DefaultLoginAuthConfig {
  githubClientId: string;
  firebaseApiKey: string;
}

// Single source of truth for built-in auth defaults.
export const DEFAULT_LOGIN_AUTH_CONFIG: DefaultLoginAuthConfig = Object.freeze({
  githubClientId: "Ov23linag5Xc0ufzhxsv",
  firebaseApiKey: "AIzaSyB1eLZYLzmkrEdXXT6aZKB7sIWkTvKzf6M",
});
