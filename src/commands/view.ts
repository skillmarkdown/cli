import { parseSkillId } from "../lib/registry/skill-id";
import { readSearchSelectionCache, type SearchSelectionCache } from "../lib/search/selection-cache";
import { failWithUsage } from "../lib/shared/command-output";
import { VIEW_USAGE } from "../lib/shared/cli-text";
import { getSkillView } from "../lib/view/client";
import { getViewEnvConfig, type ViewEnvConfig } from "../lib/view/config";
import { isViewApiError } from "../lib/view/errors";
import { parseViewFlags } from "../lib/view/flags";
import { type ViewResponse } from "../lib/view/types";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";

interface ViewCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => ViewEnvConfig;
  readSelectionCache?: () => SearchSelectionCache | null;
  getSkillView?: (
    baseUrl: string,
    request: { ownerSlug: string; skillSlug: string },
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<ViewResponse>;
  resolveReadIdToken?: () => Promise<string | null>;
}

function shouldRetryWithReadToken(error: unknown): boolean {
  return (
    isViewApiError(error) && (error.status === 401 || error.status === 403 || error.status === 404)
  );
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function printHumanResult(payload: ViewResponse): void {
  const canonicalSkillId = `@${payload.ownerLogin}/${payload.skill}`;
  console.log(`Skill: ${canonicalSkillId}`);
  console.log(`Owner: ${payload.owner} (login: ${payload.ownerLogin})`);
  console.log(`Updated: ${payload.updatedAt}`);
  console.log(`Visibility: ${payload.visibility}`);
  console.log(`Description: ${payload.description || "-"}`);
  console.log("Channels:");
  console.log(`  latest: ${payload.channels.latest ?? "-"}`);
  console.log(`  beta: ${payload.channels.beta ?? "-"}`);
  console.log(`Next: skillmd history ${canonicalSkillId} --limit 20`);
}

function normalizeRegistryBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "");
}

function resolveRequestedSkillId(
  requestedSkillId: string,
  registryBaseUrl: string,
  readSelectionCacheFn: () => SearchSelectionCache | null,
): string {
  if (!/^\d+$/u.test(requestedSkillId)) {
    return requestedSkillId;
  }

  const selectedIndex = Number.parseInt(requestedSkillId, 10);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1) {
    throw new Error(
      "invalid search result index. Use a positive integer (for example: 'skillmd view 1').",
    );
  }

  const cache = readSelectionCacheFn();
  if (!cache) {
    throw new Error("no cached search results found. Run 'skillmd search' first.");
  }

  if (
    normalizeRegistryBaseUrl(cache.registryBaseUrl) !== normalizeRegistryBaseUrl(registryBaseUrl)
  ) {
    throw new Error(
      "cached search results are from a different registry. Run 'skillmd search' in this environment first.",
    );
  }

  if (cache.skillIds.length === 0) {
    throw new Error(
      "cached search page is empty. Run 'skillmd search' and pick a numbered result.",
    );
  }

  const pageStartIndex = cache.pageStartIndex ?? 1;
  const pageEndIndex = pageStartIndex + cache.skillIds.length - 1;

  if (selectedIndex < pageStartIndex || selectedIndex > pageEndIndex) {
    throw new Error(
      `search result index '${selectedIndex}' is out of range for the current page (${pageStartIndex}-${pageEndIndex}).`,
    );
  }

  return cache.skillIds[selectedIndex - pageStartIndex];
}

export async function runViewCommand(
  args: string[],
  options: ViewCommandOptions = {},
): Promise<number> {
  const parsed = parseViewFlags(args);
  if (!parsed.valid || !parsed.skillId) {
    return failWithUsage("skillmd view: unsupported argument(s)", VIEW_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const getConfigFn = options.getConfig ?? getViewEnvConfig;
    const config = getConfigFn(env);
    const readSelectionCacheFn = options.readSelectionCache ?? readSearchSelectionCache;
    const resolvedSkillId = resolveRequestedSkillId(
      parsed.skillId,
      config.registryBaseUrl,
      readSelectionCacheFn,
    );
    const parsedSkillId = parseSkillId(resolvedSkillId);
    const getSkillViewFn = options.getSkillView ?? getSkillView;
    const resolveReadIdTokenFn =
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }));
    const request = {
      ownerSlug: parsedSkillId.ownerSlug,
      skillSlug: parsedSkillId.skillSlug,
    };
    let response: ViewResponse;
    try {
      response = await getSkillViewFn(config.registryBaseUrl, request, {
        timeoutMs: config.requestTimeoutMs,
      });
    } catch (error) {
      if (!shouldRetryWithReadToken(error)) {
        throw error;
      }

      const idToken = await resolveReadIdTokenFn();
      if (!idToken) {
        throw error;
      }

      response = await getSkillViewFn(config.registryBaseUrl, request, {
        timeoutMs: config.requestTimeoutMs,
        idToken,
      });
    }

    if (parsed.json) {
      printJson(response as unknown as Record<string, unknown>);
      return 0;
    }

    printHumanResult(response);
    return 0;
  } catch (error) {
    if (isViewApiError(error)) {
      console.error(`skillmd view: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd view: ${message}`);
    return 1;
  }
}
