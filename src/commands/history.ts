import { listSkillVersionHistory } from "../lib/history/client";
import { getHistoryEnvConfig, type HistoryEnvConfig } from "../lib/history/config";
import { isHistoryApiError } from "../lib/history/errors";
import { parseHistoryFlags } from "../lib/history/flags";
import { type HistoryResponse } from "../lib/history/types";
import { parseSkillId } from "../lib/registry/skill-id";
import { HISTORY_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";
import { renderTable } from "../lib/shared/table";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";

interface HistoryCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => HistoryEnvConfig;
  listHistory?: (
    baseUrl: string,
    request: { ownerSlug: string; skillSlug: string; limit?: number; cursor?: string },
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<HistoryResponse>;
  resolveReadIdToken?: () => Promise<string | null>;
}

function shouldRetryWithReadToken(error: unknown): boolean {
  return (
    isHistoryApiError(error) &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  );
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function formatDigestForHuman(digest: string): string {
  if (!digest.startsWith("sha256:")) {
    return digest;
  }

  const value = digest.slice("sha256:".length);
  if (value.length <= 12) {
    return digest;
  }

  return `sha256:${value.slice(0, 12)}...`;
}

function printHumanResults(skillId: string, limit: number | undefined, payload: HistoryResponse) {
  const maxWidth = process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;

  if (payload.results.length === 0) {
    console.log("No versions found.");
  } else {
    const lines = renderTable(
      [
        {
          header: "VERSION",
          width: 10,
          value: (row) => row.version,
        },
        {
          header: "PUBLISHED",
          width: 20,
          value: (row) => row.publishedAt,
        },
        {
          header: "YANKED",
          minWidth: 10,
          maxWidth: 24,
          shrinkPriority: 2,
          value: (row) => {
            if (!row.yanked) {
              return "no";
            }
            return row.yankedReason ? `yes:${row.yankedReason}` : "yes";
          },
        },
        {
          header: "SIZE",
          width: 10,
          align: "right",
          value: (row) => row.sizeBytes,
        },
        {
          header: "DIGEST",
          width: 24,
          value: (row) => formatDigestForHuman(row.digest),
        },
        {
          header: "MEDIA",
          minWidth: 16,
          maxWidth: 42,
          shrinkPriority: 3,
          value: (row) => row.mediaType,
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
    const parts = ["skillmd history", skillId];
    if (limit) {
      parts.push("--limit", String(limit));
    }
    parts.push("--cursor", payload.nextCursor);
    console.log(`Next page: ${parts.join(" ")}`);
  }
}

export async function runHistoryCommand(
  args: string[],
  options: HistoryCommandOptions = {},
): Promise<number> {
  const parsed = parseHistoryFlags(args);
  if (!parsed.valid || !parsed.skillId) {
    return failWithUsage("skillmd history: unsupported argument(s)", HISTORY_USAGE);
  }

  try {
    const parsedSkillId = parseSkillId(parsed.skillId);
    const env = options.env ?? process.env;
    const getConfigFn = options.getConfig ?? getHistoryEnvConfig;
    const config = getConfigFn(env);
    const listHistoryFn = options.listHistory ?? listSkillVersionHistory;
    const resolveReadIdTokenFn =
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }));
    const request = {
      ownerSlug: parsedSkillId.ownerSlug,
      skillSlug: parsedSkillId.skillSlug,
      limit: parsed.limit,
      cursor: parsed.cursor,
    };
    let response: HistoryResponse;
    try {
      response = await listHistoryFn(config.registryBaseUrl, request, {
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

      response = await listHistoryFn(config.registryBaseUrl, request, {
        timeoutMs: config.requestTimeoutMs,
        idToken,
      });
    }

    if (parsed.json) {
      printJson(response as unknown as Record<string, unknown>);
      return 0;
    }

    printHumanResults(parsedSkillId.skillId, parsed.limit, response);
    return 0;
  } catch (error) {
    if (isHistoryApiError(error)) {
      console.error(`skillmd history: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd history: ${message}`);
    return 1;
  }
}
