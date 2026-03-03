import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { parseDeprecateFlags, parseDeprecateRequest } from "../lib/deprecate/flags";
import { deprecateVersions as defaultDeprecateVersions } from "../lib/deprecate/client";
import { getDeprecateEnvConfig } from "../lib/deprecate/config";
import { isDeprecateApiError } from "../lib/deprecate/errors";
import { type DeprecateEnvConfig, type DeprecateVersionsResponse } from "../lib/deprecate/types";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import { DEPRECATE_USAGE } from "../lib/shared/cli-text";

interface DeprecateCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => DeprecateEnvConfig;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  deprecateVersions?: (
    baseUrl: string,
    idToken: string,
    request: {
      ownerSlug: string;
      skillSlug: string;
      range: string;
      message: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<DeprecateVersionsResponse>;
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
    const config = (options.getConfig ?? getDeprecateEnvConfig)(env);
    const parsedSkillId = parseSkillId(parsedRequest.skillId);
    const session = (options.readSession ?? readAuthSession)();
    if (!session) {
      console.error("skillmd deprecate: not logged in. Run 'skillmd login' first.");
      return 1;
    }

    const owner = deriveOwnerFromSession(session);
    if (!owner) {
      console.error(
        "skillmd deprecate: missing GitHub username in session. Run 'skillmd login --reauth' first.",
      );
      return 1;
    }

    if (session.projectId && session.projectId !== config.firebaseProjectId) {
      console.error(
        `skillmd deprecate: session project '${session.projectId}' does not match current config ` +
          `'${config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
      );
      return 1;
    }

    if (`@${parsedSkillId.ownerSlug}` !== owner) {
      console.error(`skillmd deprecate: can only update skills owned by ${owner}.`);
      return 1;
    }

    const idTokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
      config.firebaseApiKey,
      session.refreshToken,
    );
    const result = await (options.deprecateVersions ?? defaultDeprecateVersions)(
      config.registryBaseUrl,
      idTokenSession.idToken,
      {
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        range: parsedRequest.range,
        message: parsedRequest.message,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    if (parsedRequest.json) {
      printJson(result as unknown as Record<string, unknown>);
    } else {
      console.log(
        `Deprecated ${result.affectedVersions.length} version(s) for ${parsedSkillId.skillId} using range ${result.range}.`,
      );
    }
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
