import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { parseDeprecateFlags, parseDeprecateRequest } from "../lib/deprecate/flags";
import { deprecateVersions as defaultDeprecateVersions } from "../lib/deprecate/client";
import { isDeprecateApiError } from "../lib/deprecate/errors";
import { type DeprecateEnvConfig, type DeprecateVersionsResponse } from "../lib/deprecate/types";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage, printCommandResult } from "../lib/shared/command-output";
import { DEPRECATE_USAGE } from "../lib/shared/cli-text";
import { getAuthRegistryEnvConfig } from "../lib/shared/env-config";

interface DeprecateCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => DeprecateEnvConfig;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  deprecateVersions?: (
    baseUrl: string,
    idToken: string,
    request: {
      username: string;
      skillSlug: string;
      range: string;
      message: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<DeprecateVersionsResponse>;
}

export async function runDeprecateCommand(
  args: string[],
  options: DeprecateCommandOptions = {},
): Promise<number> {
  const parsedFlags = parseDeprecateFlags(args);
  const parsedRequest = parseDeprecateRequest(parsedFlags);
  if (!parsedRequest) {
    return failWithUsage("skillmd deprecate: unsupported argument(s)", DEPRECATE_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getAuthRegistryEnvConfig)(env);
    const parsedSkillId = parseSkillId(parsedRequest.skillId);
    const auth = await resolveWriteAuth({
      command: "skillmd deprecate",
      env,
      config,
      readSession: options.readSession ?? readAuthSession,
      exchangeRefreshToken: options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken,
      requireOwner: true,
      targetOwnerSlug: parsedSkillId.username,
    });
    if (!auth.ok) {
      console.error(auth.message);
      return 1;
    }

    const result = await (options.deprecateVersions ?? defaultDeprecateVersions)(
      config.registryBaseUrl,
      auth.value.idToken,
      {
        username: parsedSkillId.username,
        skillSlug: parsedSkillId.skillSlug,
        range: parsedRequest.range,
        message: parsedRequest.message,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    printCommandResult(parsedRequest.json, result, () => {
      console.log(
        `Deprecated ${result.affectedVersions.length} version(s) for ${parsedSkillId.skillId} using range ${result.range}.`,
      );
    });
    return 0;
  } catch (error) {
    if (isDeprecateApiError(error)) {
      console.error(`skillmd deprecate: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd deprecate: ${message}`);
    return 1;
  }
}
