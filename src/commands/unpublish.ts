import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { getWhoami as defaultGetWhoami } from "../lib/whoami/client";
import { type WhoamiResponse } from "../lib/whoami/types";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import { UNPUBLISH_USAGE } from "../lib/shared/cli-text";
import { executeWriteCommand } from "../lib/shared/command-execution";
import { getAuthRegistryEnvConfig } from "../lib/shared/env-config";
import { isUnpublishApiError } from "../lib/unpublish/errors";
import { parseUnpublishFlags, parseUnpublishRequest } from "../lib/unpublish/flags";
import { type UnpublishEnvConfig, type UnpublishVersionResponse } from "../lib/unpublish/types";
import { unpublishVersion as defaultUnpublishVersion } from "../lib/unpublish/client";

interface UnpublishCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => UnpublishEnvConfig;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  getWhoami?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<WhoamiResponse>;
  unpublishVersion?: (
    baseUrl: string,
    idToken: string,
    request: {
      username: string;
      skillSlug: string;
      version: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<UnpublishVersionResponse>;
}

export async function runUnpublishCommand(
  args: string[],
  options: UnpublishCommandOptions = {},
): Promise<number> {
  const parsedFlags = parseUnpublishFlags(args);
  const parsedRequest = parseUnpublishRequest(parsedFlags);
  if (!parsedRequest) {
    return failWithUsage("skillmd unpublish: unsupported argument(s)", UNPUBLISH_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getAuthRegistryEnvConfig)(env);
    const parsedSkillId = parseSkillId(parsedRequest.skillId);
    return executeWriteCommand<UnpublishVersionResponse>({
      command: "skillmd unpublish",
      json: parsedRequest.json,
      resolveAuth: async () => {
        const auth = await resolveWriteAuth({
          command: "skillmd unpublish",
          env,
          config,
          readSession: options.readSession ?? readAuthSession,
          exchangeRefreshToken: options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken,
          getWhoami: options.getWhoami ?? defaultGetWhoami,
          requireOwner: true,
          targetOwnerSlug: parsedSkillId.username,
        });
        return auth.ok
          ? { ok: true as const, idToken: auth.value.idToken }
          : { ok: false as const, message: auth.message };
      },
      run: (idToken) =>
        (options.unpublishVersion ?? defaultUnpublishVersion)(
          config.registryBaseUrl,
          idToken,
          {
            username: parsedSkillId.username,
            skillSlug: parsedSkillId.skillSlug,
            version: parsedRequest.version,
          },
          { timeoutMs: config.requestTimeoutMs },
        ),
      printHuman: (result) => {
        const removedTags = result.removedTags.length > 0 ? result.removedTags.join(",") : "none";
        console.log(
          `Unpublished ${parsedSkillId.skillId}@${result.version}. Removed tags: ${removedTags}.`,
        );
      },
      isApiError: isUnpublishApiError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd unpublish: ${message}`);
    return 1;
  }
}
