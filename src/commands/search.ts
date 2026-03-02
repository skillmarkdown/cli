import { searchSkills } from "../lib/search/client";
import { getSearchEnvConfig, type SearchEnvConfig } from "../lib/search/config";
import { isSearchApiError } from "../lib/search/errors";
import { parseSearchFlags } from "../lib/search/flags";
import { SEARCH_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";
import { renderTable } from "../lib/shared/table";
import { type SearchSkillsResponse } from "../lib/search/types";

interface SearchCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => SearchEnvConfig;
  searchSkills?: (
    baseUrl: string,
    request: { query?: string; limit?: number; cursor?: string },
    options?: { timeoutMs?: number },
  ) => Promise<SearchSkillsResponse>;
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
  payload: SearchSkillsResponse,
) {
  const maxWidth = process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;

  if (payload.results.length === 0) {
    console.log("No skills found.");
  } else {
    const lines = renderTable(
      [
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
      payload.results,
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
    const response = await searchSkillsFn(
      config.registryBaseUrl,
      {
        query: parsed.query,
        limit: parsed.limit,
        cursor: parsed.cursor,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    if (parsed.json) {
      printJson(response as unknown as Record<string, unknown>);
      return 0;
    }

    printHumanResults(parsed.query, parsed.limit, response);
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
