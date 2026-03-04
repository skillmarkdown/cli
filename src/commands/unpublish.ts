import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveConfiguredAuthToken } from "../lib/auth/api-token";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import { UNPUBLISH_USAGE } from "../lib/shared/cli-text";
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
  unpublishVersion?: (
    baseUrl: string,
    idToken: string,
    request: {
      ownerSlug: string;
      skillSlug: string;
      version: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<UnpublishVersionResponse>;
}

const GITHUB_USERNAME_PATTERN = /^[a-z0-9]+(?:-?[a-z0-9]+)*$/i;

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function deriveOwnerFromSession(session: AuthSession): string | null {
  if (!session.githubUsername) {
    return null;
  }

  const cleaned = session.githubUsername.trim().replace(/^@+/, "");
  if (!cleaned || !GITHUB_USERNAME_PATTERN.test(cleaned)) {
    return null;
  }

  return `@${cleaned.toLowerCase()}`;
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
    const configuredAuthToken = resolveConfiguredAuthToken(env);
    const session = (options.readSession ?? readAuthSession)();
    if (!configuredAuthToken && !session) {
      console.error("skillmd unpublish: not logged in. Run 'skillmd login' first.");
      return 1;
    }

    const owner = session ? deriveOwnerFromSession(session) : null;
    if (!configuredAuthToken && !owner) {
      console.error(
        "skillmd unpublish: missing GitHub username in session. Run 'skillmd login --reauth' first.",
      );
      return 1;
    }

    if (
      !configuredAuthToken &&
      session &&
      session.projectId &&
      session.projectId !== config.firebaseProjectId
    ) {
      console.error(
        `skillmd unpublish: session project '${session.projectId}' does not match current config ` +
          `'${config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
      );
      return 1;
    }

    if (!configuredAuthToken && `@${parsedSkillId.ownerSlug}` !== owner) {
      console.error(`skillmd unpublish: can only update skills owned by ${owner}.`);
      return 1;
    }

    let idToken = configuredAuthToken;
    if (!idToken) {
      const idTokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
        config.firebaseApiKey,
        session!.refreshToken,
      );
      idToken = idTokenSession.idToken;
    }
    const result = await (options.unpublishVersion ?? defaultUnpublishVersion)(
      config.registryBaseUrl,
      idToken,
      {
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        version: parsedRequest.version,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    if (parsedRequest.json) {
      printJson(result as unknown as Record<string, unknown>);
    } else {
      const removedTags = result.removedTags.length > 0 ? result.removedTags.join(",") : "none";
      console.log(
        `Unpublished ${parsedSkillId.skillId}@${result.version}. Removed tags: ${removedTags}.`,
      );
    }
    return 0;
  } catch (error) {
    if (isUnpublishApiError(error)) {
      console.error(`skillmd unpublish: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd unpublish: ${message}`);
    return 1;
  }
}
