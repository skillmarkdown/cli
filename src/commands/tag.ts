import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { callWithReadTokenRetry, isReadTokenRetryableStatus } from "../lib/auth/read-token-retry";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import { TAG_USAGE } from "../lib/shared/cli-text";
import { listDistTags, removeDistTag, setDistTag } from "../lib/tag/client";
import { getTagEnvConfig } from "../lib/tag/config";
import { isTagApiError } from "../lib/tag/errors";
import { parseTagFlags } from "../lib/tag/flags";
import {
  type DistTagDeleteResponse,
  type DistTagsListResponse,
  type DistTagUpdateResponse,
  type TagEnvConfig,
} from "../lib/tag/types";

interface TagCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => TagEnvConfig;
  readSession?: () => AuthSession | null;
  resolveReadIdToken?: () => Promise<string | null>;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  listDistTags?: (
    baseUrl: string,
    request: { ownerSlug: string; skillSlug: string },
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<DistTagsListResponse>;
  setDistTag?: (
    baseUrl: string,
    idToken: string,
    request: {
      ownerSlug: string;
      skillSlug: string;
      tag: string;
      version: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<DistTagUpdateResponse>;
  removeDistTag?: (
    baseUrl: string,
    idToken: string,
    request: { ownerSlug: string; skillSlug: string; tag: string },
    options?: { timeoutMs?: number },
  ) => Promise<DistTagDeleteResponse>;
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

function shouldRetryWithReadToken(error: unknown): boolean {
  return isTagApiError(error) && isReadTokenRetryableStatus(error.status);
}

function printDistTagsHuman(payload: DistTagsListResponse): void {
  console.log(`Skill: @${payload.ownerLogin}/${payload.skill}`);
  console.log(`Updated: ${payload.updatedAt}`);
  console.log("Dist-Tags:");
  const tags = Object.entries(payload.distTags).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (tags.length === 0) {
    console.log("  (none)");
    return;
  }

  for (const [tag, version] of tags) {
    console.log(`  ${tag}: ${version}`);
  }
}

export async function runTagCommand(
  args: string[],
  options: TagCommandOptions = {},
): Promise<number> {
  const parsed = parseTagFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd tag: unsupported argument(s)", TAG_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const parsedSkillId = parseSkillId(parsed.skillId);
    const getConfigFn = options.getConfig ?? getTagEnvConfig;
    const config = getConfigFn(env);

    if (parsed.action === "ls") {
      const listDistTagsFn = options.listDistTags ?? listDistTags;
      const resolveReadIdTokenFn =
        options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }));
      const { result } = await callWithReadTokenRetry<DistTagsListResponse>({
        request: (idToken) =>
          listDistTagsFn(
            config.registryBaseUrl,
            {
              ownerSlug: parsedSkillId.ownerSlug,
              skillSlug: parsedSkillId.skillSlug,
            },
            {
              timeoutMs: config.requestTimeoutMs,
              idToken,
            },
          ),
        resolveReadIdToken: resolveReadIdTokenFn,
        shouldRetry: shouldRetryWithReadToken,
      });

      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printDistTagsHuman(result);
      }
      return 0;
    }

    const readSessionFn = options.readSession ?? readAuthSession;
    const session = readSessionFn();
    if (!session) {
      console.error("skillmd tag: not logged in. Run 'skillmd login' first.");
      return 1;
    }

    const owner = deriveOwnerFromSession(session);
    if (!owner) {
      console.error(
        "skillmd tag: missing GitHub username in session. Run 'skillmd login --reauth' first.",
      );
      return 1;
    }

    if (session.projectId && session.projectId !== config.firebaseProjectId) {
      console.error(
        `skillmd tag: session project '${session.projectId}' does not match current config ` +
          `'${config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
      );
      return 1;
    }

    if (`@${parsedSkillId.ownerSlug}` !== owner) {
      console.error(`skillmd tag: can only update tags for skills owned by ${owner}.`);
      return 1;
    }

    const exchangeRefreshTokenFn = options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken;
    const idTokenSession = await exchangeRefreshTokenFn(
      config.firebaseApiKey,
      session.refreshToken,
    );

    if (parsed.action === "add") {
      const setDistTagFn = options.setDistTag ?? setDistTag;
      const result = await setDistTagFn(
        config.registryBaseUrl,
        idTokenSession.idToken,
        {
          ownerSlug: parsedSkillId.ownerSlug,
          skillSlug: parsedSkillId.skillSlug,
          tag: parsed.tag,
          version: parsed.version,
        },
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        console.log(
          `Updated dist-tag ${result.tag} -> ${result.version} for ${parsedSkillId.skillId}.`,
        );
      }
      return 0;
    }

    const removeDistTagFn = options.removeDistTag ?? removeDistTag;
    const result = await removeDistTagFn(
      config.registryBaseUrl,
      idTokenSession.idToken,
      {
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        tag: parsed.tag,
      },
      { timeoutMs: config.requestTimeoutMs },
    );
    if (parsed.json) {
      printJson(result as unknown as Record<string, unknown>);
    } else {
      console.log(`Removed dist-tag ${result.tag} from ${parsedSkillId.skillId}.`);
    }
    return 0;
  } catch (error) {
    if (isTagApiError(error)) {
      console.error(`skillmd tag: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd tag: ${message}`);
    return 1;
  }
}
