import { listSkillVersionHistory } from "../lib/history/client";
import { getHistoryEnvConfig, type HistoryEnvConfig } from "../lib/history/config";
import { isHistoryApiError } from "../lib/history/errors";
import { parseHistoryFlags } from "../lib/history/flags";
import { type HistoryResponse } from "../lib/history/types";
import { parseSkillId } from "../lib/registry/skill-id";
import { HISTORY_USAGE } from "../lib/shared/cli-text";
import { failWithUsage } from "../lib/shared/command-output";

interface HistoryCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => HistoryEnvConfig;
  listHistory?: (
    baseUrl: string,
    request: { ownerSlug: string; skillSlug: string; limit?: number; cursor?: string },
    options?: { timeoutMs?: number },
  ) => Promise<HistoryResponse>;
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function printHumanResults(skillId: string, limit: number | undefined, payload: HistoryResponse) {
  if (payload.results.length === 0) {
    console.log("No versions found.");
  } else {
    for (const item of payload.results) {
      const yankedSummary = item.yanked ? ` yanked=yes (${item.yankedReason ?? "no reason"})` : "";
      console.log(
        `${skillId}@${item.version} published=${item.publishedAt} size=${item.sizeBytes} ` +
          `media=${item.mediaType} digest=${item.digest}${yankedSummary}`,
      );
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
    const response = await listHistoryFn(
      config.registryBaseUrl,
      {
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        limit: parsed.limit,
        cursor: parsed.cursor,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

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
