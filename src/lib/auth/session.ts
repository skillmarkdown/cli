import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SESSION_PATH = join(homedir(), ".skillmd", "auth.json");

export interface AuthSession {
  provider: "github";
  uid: string;
  githubUsername?: string;
  email?: string;
  refreshToken: string;
  projectId?: string;
}

export function getDefaultSessionPath(): string {
  return SESSION_PATH;
}

export function readAuthSession(sessionPath: string = SESSION_PATH): AuthSession | null {
  if (!existsSync(sessionPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(sessionPath, "utf8")) as AuthSession;
    if (
      !parsed ||
      parsed.provider !== "github" ||
      typeof parsed.uid !== "string" ||
      parsed.uid.length === 0 ||
      typeof parsed.refreshToken !== "string" ||
      parsed.refreshToken.length === 0
    ) {
      return null;
    }

    if (parsed.email !== undefined && typeof parsed.email !== "string") {
      return null;
    }
    if (parsed.githubUsername !== undefined && typeof parsed.githubUsername !== "string") {
      return null;
    }
    if (typeof parsed.githubUsername === "string" && parsed.githubUsername.trim().length === 0) {
      return null;
    }
    if (parsed.projectId !== undefined && typeof parsed.projectId !== "string") {
      return null;
    }
    if (typeof parsed.projectId === "string" && parsed.projectId.length === 0) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession, sessionPath: string = SESSION_PATH): void {
  const parentDir = dirname(sessionPath);
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(sessionPath, JSON.stringify(session, null, 2), { encoding: "utf8", mode: 0o600 });
  chmodSync(sessionPath, 0o600);
}

export function clearAuthSession(sessionPath: string = SESSION_PATH): boolean {
  if (!existsSync(sessionPath)) {
    return false;
  }

  rmSync(sessionPath, { force: true });
  return true;
}
