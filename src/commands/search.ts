import { searchSkills } from "../lib/search/client";
import { getSearchEnvConfig, type SearchEnvConfig } from "../lib/search/config";
import { isSearchApiError } from "../lib/search/errors";
import { parseSearchFlags } from "../lib/search/flags";
import {
  buildSearchContinuationKey,
  readSearchSelectionCache,
  writeSearchSelectionCache,
  type SearchSelectionCache,
} from "../lib/search/selection-cache";
import { SEARCH_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";
import { renderTable } from "../lib/shared/table";
import { type SearchSkillsResponse } from "../lib/search/types";

interface IndexedSearchResult {
  index: number;
  skillId: string;
  channels: {
    latest?: string;
    beta?: string;
  };
  updatedAt: string;
  description: string;
}

interface SearchCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => SearchEnvConfig;
  searchSkills?: (
    baseUrl: string,
    request: { query?: string; limit?: number; cursor?: string },
    options?: { timeoutMs?: number },
  ) => Promise<SearchSkillsResponse>;
  readSelectionCache?: () => SearchSelectionCache | null;
  writeSelectionCache?: (cache: SearchSelectionCache) => void;
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function formatUpdatedAtForTable(value: string): string {
  const isoPrefix = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (isoPrefix) {
    return isoPrefix[1];
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 16);
  }

  return value;
}

function printHumanResults(
  query: string | undefined,
  limit: number | undefined,
  startIndex: number,
  payload: SearchSkillsResponse,
) {
  const maxWidth = process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;

  if (payload.results.length === 0) {
    console.log("No skills found.");
  } else {
    const lastVisibleIndex = startIndex + payload.results.length - 1;
    const indexedResults: IndexedSearchResult[] = payload.results.map((result, rowIndex) => ({
      index: startIndex + rowIndex,
      skillId: result.skillId,
      channels: result.channels,
      updatedAt: result.updatedAt,
      description: result.description,
    }));

    const lines = renderTable(
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
          value: (row) => row.channels.latest ?? "-",
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
    );

    for (const line of lines) {
      console.log(line);
    }
  }

  if (payload.nextCursor) {
    const parts = ["skillmd search"];
    if (query) {
      parts.push(query);
    }
    if (limit) {
      parts.push("--limit", String(limit));
    }
    parts.push("--cursor", payload.nextCursor);
    console.log(`Next page: ${parts.join(" ")}`);
  }
}

function resolvePageStartIndex(params: {
  registryBaseUrl: string;
  query: string | null;
  limit: number;
  cursor?: string;
  cache: SearchSelectionCache | null;
}): number {
  if (!params.cursor || !params.cache?.continuations?.length) {
    return 1;
  }

  const key = buildSearchContinuationKey({
    registryBaseUrl: params.registryBaseUrl,
    query: params.query,
    limit: params.limit,
    cursor: params.cursor,
  });

  const match = params.cache.continuations.find((entry) => entry.key === key);
  if (!match) {
    return 1;
  }

  return match.nextIndex;
}

function buildUpdatedContinuations(params: {
  existing: SearchSelectionCache | null;
  registryBaseUrl: string;
  query: string | null;
  limit: number;
  nextCursor: string | null;
  nextIndex: number;
  nowIso: string;
}): SearchSelectionCache["continuations"] {
  const existing = params.existing?.continuations ?? [];
  const filtered = existing.filter((entry) => entry.key.length > 0);

  if (!params.nextCursor) {
    return filtered.slice(-100);
  }

  const key = buildSearchContinuationKey({
    registryBaseUrl: params.registryBaseUrl,
    query: params.query,
    limit: params.limit,
    cursor: params.nextCursor,
  });

  const withoutExistingKey = filtered.filter((entry) => entry.key !== key);
  const updated = [
    ...withoutExistingKey,
    {
      key,
      nextIndex: params.nextIndex,
      createdAt: params.nowIso,
    },
  ];

  return updated.slice(-100);
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
    const getConfigFn = options.getConfig ?? getSearchEnvConfig;
    const config = getConfigFn(env);
    const searchSkillsFn = options.searchSkills ?? searchSkills;
    const readSelectionCacheFn = options.readSelectionCache ?? readSearchSelectionCache;
    const writeSelectionCacheFn = options.writeSelectionCache ?? writeSearchSelectionCache;
    const existingCache = readSelectionCacheFn();
    const response = await searchSkillsFn(
      config.registryBaseUrl,
      {
        query: parsed.query,
        limit: parsed.limit,
        cursor: parsed.cursor,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    const pageStartIndex = resolvePageStartIndex({
      registryBaseUrl: config.registryBaseUrl,
      query: response.query,
      limit: response.limit,
      cursor: parsed.cursor,
      cache: existingCache,
    });
    const nowIso = new Date().toISOString();
    const continuations = buildUpdatedContinuations({
      existing: existingCache,
      registryBaseUrl: config.registryBaseUrl,
      query: response.query,
      limit: response.limit,
      nextCursor: response.nextCursor,
      nextIndex: pageStartIndex + response.results.length,
      nowIso,
    });

    try {
      writeSelectionCacheFn({
        registryBaseUrl: config.registryBaseUrl,
        createdAt: nowIso,
        skillIds: response.results.map((result) => result.skillId),
        pageStartIndex,
        continuations,
      });
    } catch {
      // Cache persistence is best-effort and must not fail command execution.
    }

    if (parsed.json) {
      printJson(response as unknown as Record<string, unknown>);
      return 0;
    }

    printHumanResults(parsed.query, parsed.limit, pageStartIndex, response);
    return 0;
  } catch (error) {
    if (isSearchApiError(error)) {
      console.error(`skillmd search: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd search: ${message}`);
    return 1;
  }
}
