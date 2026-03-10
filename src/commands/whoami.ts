import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { failWithUsage, printCommandResult } from "../lib/shared/command-output";
import { WHOAMI_USAGE } from "../lib/shared/cli-text";
import { getLoginScopedRegistryEnvConfig } from "../lib/shared/env-config";
import { getWhoami as defaultGetWhoami } from "../lib/whoami/client";
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

function printWhoamiHuman(result: WhoamiResponse): void {
  console.log(`Owner: ${result.owner} (${result.username})`);
  console.log(`UID: ${result.uid}`);
  const authLabel = result.authType === "firebase" ? "account session" : `token (${result.scope})`;
  console.log(`Auth: ${authLabel}`);
  console.log(`Project: ${result.projectId ?? "unknown"}`);
  console.log(`Email: ${result.email ?? "-"}`);
  if (result.plan) {
    console.log(`Plan: ${result.plan}`);
  }
  if (result.organizations && result.organizations.length > 0) {
    console.log(
      `Organizations: ${result.organizations
        .map((organization) => `${organization.owner} (${organization.role})`)
        .join(", ")}`,
    );
  }
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
    const config = (options.getConfig ?? getLoginScopedRegistryEnvConfig)(env);
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

    printCommandResult(parsed.json, result, () => printWhoamiHuman(result));
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
