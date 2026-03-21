import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { getRegistryEnvConfig, type RegistryEnvConfig } from "../lib/registry/config";
import { searchSkills } from "../lib/search/client";
import { isSearchApiError } from "../lib/search/errors";
import { parseSearchFlags } from "../lib/search/flags";
import {
  buildSearchContinuationKey,
  readSearchSelectionCache,
  writeSearchSelectionCache,
  type SearchSelectionCache,
} from "../lib/search/selection-cache";
import { type SearchSkillsResponse } from "../lib/search/types";
import { SEARCH_USAGE } from "../lib/shared/cli-text";
import { failWithUsage, printCommandResult } from "../lib/shared/command-output";
import { renderTable } from "../lib/shared/table";
import {
  formatCliApiErrorWithHint,
  SKILLMARKDOWN_WEBSITE_URL,
} from "../lib/shared/authz-error-hints";

interface SearchCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => RegistryEnvConfig;
  searchSkills?: (
    baseUrl: string,
    request: {
      query?: string;
      limit?: number;
      cursor?: string;
      scope?: "public" | "private";
      match?: "all" | "id";
    },
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<SearchSkillsResponse>;
  readSelectionCache?: () => SearchSelectionCache | null;
  writeSelectionCache?: (cache: SearchSelectionCache) => void;
  resolveReadIdToken?: () => Promise<string | null>;
}

const MAX_CONTINUATIONS = 100;

function formatUpdatedAtForTable(value: string): string {
  const isoPrefix = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (isoPrefix) {
    return isoPrefix[1];
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 16);
}

function renderSearchResults(startIndex: number, payload: SearchSkillsResponse): void {
  if (payload.results.length === 0) {
    console.log("No skills found.");
    return;
  }

  const maxWidth = process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;
  const lastVisibleIndex = startIndex + payload.results.length - 1;
  const indexedResults = payload.results.map((result, rowIndex) => ({
    index: startIndex + rowIndex,
    skillId: result.skillId,
    distTags: result.distTags ?? {},
    updatedAt: result.updatedAt,
    description: result.description,
  }));

  for (const line of renderTable(
    [
      {
        header: "#",
        width: Math.max(2, String(lastVisibleIndex).length),
        align: "right",
        value: (row) => row.index,
      },
      {
        header: "SKILL",
        minWidth: 28,
        maxWidth: 48,
        shrinkPriority: 0,
        wrap: true,
        maxLines: 3,
        value: (row) => row.skillId,
      },
      {
        header: "LATEST",
        width: 10,
        value: (row) => row.distTags.latest ?? "-",
      },
      {
        header: "UPDATED",
        width: 16,
        minWidth: 16,
        value: (row) => formatUpdatedAtForTable(row.updatedAt),
      },
      {
        header: "DESCRIPTION",
        minWidth: 12,
        maxWidth: 64,
        shrinkPriority: 5,
        value: (row) => row.description ?? "",
      },
    ],
    indexedResults,
    { maxWidth },
  )) {
    console.log(line);
  }
}

function printNextPageHint(params: {
  query: string | undefined;
  limit: number | undefined;
  scope: "public" | "private";
  nextCursor: string;
}): void {
  const parts = ["skillmd", "search"];
  if (params.query) {
    parts.push(params.query);
  }
  if (params.limit) {
    parts.push("--limit", String(params.limit));
  }
  if (params.scope === "private") {
    parts.push("--scope", "private");
  }
  parts.push("--cursor", params.nextCursor);
  console.log(`Next page: ${parts.join(" ")}`);
}

function resolvePageStartIndex(params: {
  registryBaseUrl: string;
  query: string | null;
  limit: number;
  scope: "public" | "private";
  cursor?: string;
  cache: SearchSelectionCache | null;
}): number {
  if (!params.cursor || !params.cache?.continuations?.length) {
    return 1;
  }
  const key = buildSearchContinuationKey({
    registryBaseUrl: params.registryBaseUrl,
    query: params.query,
    scope: params.scope,
    limit: params.limit,
    cursor: params.cursor,
  });
  return params.cache.continuations.find((entry) => entry.key === key)?.nextIndex ?? 1;
}

function buildUpdatedContinuations(params: {
  existing: SearchSelectionCache | null;
  registryBaseUrl: string;
  query: string | null;
  scope: "public" | "private";
  limit: number;
  nextCursor: string | null;
  nextIndex: number;
  nowIso: string;
}): SearchSelectionCache["continuations"] {
  const existing = (params.existing?.continuations ?? []).filter((entry) => entry.key.length > 0);
  if (!params.nextCursor) {
    return existing.slice(-MAX_CONTINUATIONS);
  }

  const key = buildSearchContinuationKey({
    registryBaseUrl: params.registryBaseUrl,
    query: params.query,
    scope: params.scope,
    limit: params.limit,
    cursor: params.nextCursor,
  });

  return [
    ...existing.filter((entry) => entry.key !== key),
    { key, nextIndex: params.nextIndex, createdAt: params.nowIso },
  ].slice(-MAX_CONTINUATIONS);
}

export async function runSearchCommand(
  args: string[],
  options: SearchCommandOptions = {},
): Promise<number> {
  const parsed = parseSearchFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd search: unsupported argument(s)", SEARCH_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getRegistryEnvConfig)(env);
    const idToken = await (
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }))
    )();

    if (!idToken) {
      console.error(
        `skillmd search: search requires login. Run 'skillmd login' first at ${SKILLMARKDOWN_WEBSITE_URL}.`,
      );
      return 1;
    }

    const readSelectionCacheFn = options.readSelectionCache ?? readSearchSelectionCache;
    const writeSelectionCacheFn = options.writeSelectionCache ?? writeSearchSelectionCache;
    const existingCache = readSelectionCacheFn();
    const response = await (options.searchSkills ?? searchSkills)(
      config.registryBaseUrl,
      {
        query: parsed.query,
        limit: parsed.limit,
        cursor: parsed.cursor,
        scope: parsed.scope,
        match: parsed.scope === "public" ? "id" : "all",
      },
      { timeoutMs: config.requestTimeoutMs, idToken },
    );

    const pageStartIndex = resolvePageStartIndex({
      registryBaseUrl: config.registryBaseUrl,
      query: response.query,
      scope: parsed.scope,
      limit: response.limit,
      cursor: parsed.cursor,
      cache: existingCache,
    });
    const nowIso = new Date().toISOString();

    try {
      writeSelectionCacheFn({
        registryBaseUrl: config.registryBaseUrl,
        createdAt: nowIso,
        skillIds: response.results.map((result) => result.skillId),
        pageStartIndex,
        continuations: buildUpdatedContinuations({
          existing: existingCache,
          registryBaseUrl: config.registryBaseUrl,
          query: response.query,
          scope: parsed.scope,
          limit: response.limit,
          nextCursor: response.nextCursor,
          nextIndex: pageStartIndex + response.results.length,
          nowIso,
        }),
      });
    } catch {
      // Cache persistence is best-effort and must not fail command execution.
    }

    printCommandResult(parsed.json, response, () => {
      renderSearchResults(pageStartIndex, response);
      if (response.nextCursor) {
        printNextPageHint({
          query: parsed.query,
          limit: parsed.limit,
          scope: parsed.scope,
          nextCursor: response.nextCursor,
        });
      }
    });
    return 0;
  } catch (error) {
    if (isSearchApiError(error)) {
      console.error(formatCliApiErrorWithHint("skillmd search", error));
      return 1;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd search: ${message}`);
    return 1;
  }
}
