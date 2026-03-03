import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { failWithUsage } from "../lib/shared/command-output";
import { WHOAMI_USAGE } from "../lib/shared/cli-text";
import { getWhoami as defaultGetWhoami } from "../lib/whoami/client";
import { getWhoamiEnvConfig } from "../lib/whoami/config";
import { isWhoamiApiError } from "../lib/whoami/errors";
import { parseWhoamiFlags } from "../lib/whoami/flags";
import { type WhoamiEnvConfig, type WhoamiResponse } from "../lib/whoami/types";

interface WhoamiCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => WhoamiEnvConfig;
  resolveReadIdToken?: () => Promise<string | null>;
  getWhoami?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<WhoamiResponse>;
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

export async function runWhoamiCommand(
  args: string[],
  options: WhoamiCommandOptions = {},
): Promise<number> {
  const parsed = parseWhoamiFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd whoami: unsupported argument(s)", WHOAMI_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getWhoamiEnvConfig)(env);
    const idToken = await (
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }))
    )();
    if (!idToken) {
      console.error("skillmd whoami: not logged in. Run 'skillmd login' first.");
      return 1;
    }

    const result = await (options.getWhoami ?? defaultGetWhoami)(config.registryBaseUrl, idToken, {
      timeoutMs: config.requestTimeoutMs,
    });

    if (parsed.json) {
      printJson(result as unknown as Record<string, unknown>);
    } else {
      console.log(`Owner: ${result.owner} (${result.ownerLogin})`);
      console.log(`UID: ${result.uid}`);
      console.log(`Auth: ${result.authType} (${result.scope})`);
      console.log(`Project: ${result.projectId ?? "unknown"}`);
      console.log(`Email: ${result.email ?? "-"}`);
    }
    return 0;
  } catch (error) {
    if (isWhoamiApiError(error)) {
      console.error(`skillmd whoami: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd whoami: ${message}`);
    return 1;
  }
}
