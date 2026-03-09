import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { callWithReadTokenRetry, isReadTokenRetryableStatus } from "../lib/auth/read-token-retry";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { getWhoami as defaultGetWhoami } from "../lib/whoami/client";
import { type WhoamiResponse } from "../lib/whoami/types";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage, printCommandResult } from "../lib/shared/command-output";
import { TAG_USAGE } from "../lib/shared/cli-text";
import { getAuthRegistryEnvConfig } from "../lib/shared/env-config";
import { listDistTags, removeDistTag, setDistTag } from "../lib/tag/client";
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
  getWhoami?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<WhoamiResponse>;
  listDistTags?: (
    baseUrl: string,
    request: { username: string; skillSlug: string },
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<DistTagsListResponse>;
  setDistTag?: (
    baseUrl: string,
    idToken: string,
    request: {
      username: string;
      skillSlug: string;
      tag: string;
      version: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<DistTagUpdateResponse>;
  removeDistTag?: (
    baseUrl: string,
    idToken: string,
    request: { username: string; skillSlug: string; tag: string },
    options?: { timeoutMs?: number },
  ) => Promise<DistTagDeleteResponse>;
}

function shouldRetryWithReadToken(error: unknown): boolean {
  return isTagApiError(error) && isReadTokenRetryableStatus(error.status);
}

function printDistTagsHuman(payload: DistTagsListResponse): void {
  console.log(`Skill: @${payload.username}/${payload.skill}`);
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
    const getConfigFn = options.getConfig ?? getAuthRegistryEnvConfig;
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
              username: parsedSkillId.username,
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

      printCommandResult(parsed.json, result, () => printDistTagsHuman(result));
      return 0;
    }

    const auth = await resolveWriteAuth({
      command: "skillmd tag",
      env,
      config,
      readSession: options.readSession ?? readAuthSession,
      exchangeRefreshToken: options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken,
      getWhoami: options.getWhoami ?? defaultGetWhoami,
      requireOwner: true,
      targetOwnerSlug: parsedSkillId.username,
      ownerMismatchMessage: (owner) =>
        `skillmd tag: can only update tags for skills owned by ${owner}.`,
    });
    if (!auth.ok) {
      console.error(auth.message);
      return 1;
    }

    if (parsed.action === "add") {
      const setDistTagFn = options.setDistTag ?? setDistTag;
      const result = await setDistTagFn(
        config.registryBaseUrl,
        auth.value.idToken,
        {
          username: parsedSkillId.username,
          skillSlug: parsedSkillId.skillSlug,
          tag: parsed.tag,
          version: parsed.version,
        },
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => {
        console.log(
          `Updated dist-tag ${result.tag} -> ${result.version} for ${parsedSkillId.skillId}.`,
        );
      });
      return 0;
    }

    const removeDistTagFn = options.removeDistTag ?? removeDistTag;
    const result = await removeDistTagFn(
      config.registryBaseUrl,
      auth.value.idToken,
      {
        username: parsedSkillId.username,
        skillSlug: parsedSkillId.skillSlug,
        tag: parsed.tag,
      },
      { timeoutMs: config.requestTimeoutMs },
    );
    printCommandResult(parsed.json, result, () => {
      console.log(`Removed dist-tag ${result.tag} from ${parsedSkillId.skillId}.`);
    });
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
