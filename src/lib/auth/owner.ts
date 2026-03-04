import { type AuthSession } from "./session";

const GITHUB_USERNAME_PATTERN = /^[a-z0-9]+(?:-?[a-z0-9]+)*$/i;

export function deriveOwnerFromSession(session: AuthSession): string | null {
  if (!session.githubUsername) {
    return null;
  }
  const cleaned = session.githubUsername.trim().replace(/^@+/, "");
  if (!cleaned || !GITHUB_USERNAME_PATTERN.test(cleaned)) {
    return null;
  }
  return `@${cleaned.toLowerCase()}`;
}
