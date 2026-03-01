import { LOGOUT_USAGE } from "../lib/cli-text";
import { failWithUsage } from "../lib/command-output";
import { clearAuthSession } from "../lib/auth-session";

interface LogoutCommandOptions {
  clearSession?: () => boolean;
}

export function runLogoutCommand(args: string[], options: LogoutCommandOptions = {}): number {
  if (args.length > 0) {
    return failWithUsage("skillmd logout: unsupported argument(s)", LOGOUT_USAGE);
  }

  const clearSessionFn = options.clearSession ?? clearAuthSession;
  const removed = clearSessionFn();
  if (removed) {
    console.log("Logged out.");
    return 0;
  }

  console.log("No active session to log out.");
  return 0;
}
