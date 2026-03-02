import { promises as fs } from "node:fs";

import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { isUseApiError } from "../lib/use/errors";
import { type InstallSelector } from "../lib/use/types";
import { installFromRegistry as defaultInstallFromRegistry } from "../lib/use/workflow";
import { parseUpdateFlags } from "../lib/update/flags";
import {
  discoverInstalledSkills as defaultDiscoverInstalledSkills,
  readInstalledSkillMetadata as defaultReadInstalledSkillMetadata,
  toInstalledSkillTarget,
} from "../lib/update/discovery";
import { resolveUpdateIntent } from "../lib/update/intent";
import {
  type InstalledSkillTarget,
  type UpdateCommandEntry,
  type UpdateJsonEntry,
  type UpdateJsonResult,
  type UpdateMode,
} from "../lib/update/types";
import { failWithUsage } from "../lib/shared/command-output";
import { UPDATE_USAGE } from "../lib/shared/cli-text";
import { renderTable } from "../lib/shared/table";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";

interface UpdateCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  discoverInstalledSkills?: typeof defaultDiscoverInstalledSkills;
  readInstalledSkillMetadata?: typeof defaultReadInstalledSkillMetadata;
  installFromRegistry?: typeof defaultInstallFromRegistry;
  access?: typeof fs.access;
  resolveReadIdToken?: () => Promise<string | null>;
}

function printJson(payload: UpdateJsonResult): void {
  console.log(JSON.stringify(payload, null, 2));
}

function toSelector(resolution: ReturnType<typeof resolveUpdateIntent>): InstallSelector {
  if (resolution.selector.strategy === "channel") {
    return {
      strategy: "channel",
      channel: resolution.selector.value,
    };
  }

  return {
    strategy: "latest_fallback_beta",
  };
}

function toErrorReason(error: unknown): string {
  if (isUseApiError(error)) {
    return `${error.message} (${error.code}, status ${error.status})`;
  }

  return error instanceof Error ? error.message : "Unknown error";
}

function toJsonResult(mode: UpdateMode, entries: UpdateCommandEntry[]): UpdateJsonResult {
  const updated: UpdateJsonEntry[] = [];
  const skipped: UpdateJsonEntry[] = [];
  const failed: UpdateJsonEntry[] = [];

  for (const entry of entries) {
    const jsonEntry: UpdateJsonEntry = {
      skillId: entry.skillId,
      status: entry.status,
      fromVersion: entry.fromVersion,
      toVersion: entry.toVersion,
      reason: entry.reason,
    };

    if (entry.status === "updated") {
      updated.push(jsonEntry);
      continue;
    }
    if (entry.status === "skipped_pinned") {
      skipped.push(jsonEntry);
      continue;
    }
    failed.push(jsonEntry);
  }

  return {
    mode,
    total: entries.length,
    updated,
    skipped,
    failed,
  };
}

function printHumanResults(entries: UpdateCommandEntry[]): void {
  if (entries.length === 0) {
    console.log("No installed skills found.");
    return;
  }

  const maxWidth = process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;
  const lines = renderTable(
    [
      {
        header: "SKILL",
        minWidth: 26,
        maxWidth: 48,
        shrinkPriority: 0,
        wrap: true,
        maxLines: 2,
        value: (row) => row.skillId,
      },
      {
        header: "FROM",
        width: 14,
        value: (row) => row.fromVersion ?? "-",
      },
      {
        header: "TO",
        width: 14,
        value: (row) => row.toVersion ?? "-",
      },
      {
        header: "STATUS",
        width: 14,
        value: (row) => row.status,
      },
      {
        header: "DETAIL",
        minWidth: 12,
        maxWidth: 64,
        shrinkPriority: 4,
        value: (row) => row.reason ?? "",
      },
    ],
    entries,
    { maxWidth },
  );

  for (const line of lines) {
    console.log(line);
  }

  const updated = entries.filter((entry) => entry.status === "updated").length;
  const skipped = entries.filter((entry) => entry.status === "skipped_pinned").length;
  const failed = entries.filter((entry) => entry.status === "failed").length;
  console.log(
    `Summary: total=${entries.length} updated=${updated} skipped=${skipped} failed=${failed}`,
  );
}

export async function runUpdateCommand(
  args: string[],
  options: UpdateCommandOptions = {},
): Promise<number> {
  const parsed = parseUpdateFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd update: unsupported argument(s)", UPDATE_USAGE);
  }

  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const getConfigFn = options.getConfig ?? getUseEnvConfig;
  const discoverInstalledSkillsFn =
    options.discoverInstalledSkills ?? defaultDiscoverInstalledSkills;
  const readInstalledSkillMetadataFn =
    options.readInstalledSkillMetadata ?? defaultReadInstalledSkillMetadata;
  const installFromRegistryFn = options.installFromRegistry ?? defaultInstallFromRegistry;
  const access = options.access ?? fs.access.bind(fs);
  const resolveReadIdTokenFn =
    options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }));
  let cachedReadIdToken: string | null = null;
  let readTokenPromise: Promise<string | null> | null = null;
  const resolveReadIdTokenCached = (): Promise<string | null> => {
    if (cachedReadIdToken) {
      return Promise.resolve(cachedReadIdToken);
    }

    if (!readTokenPromise) {
      readTokenPromise = resolveReadIdTokenFn()
        .then((token) => {
          if (token) {
            cachedReadIdToken = token;
          }
          return token;
        })
        .finally(() => {
          readTokenPromise = null;
        });
    }

    return readTokenPromise;
  };

  try {
    const config = getConfigFn(env);
    const mode: UpdateMode = parsed.all || parsed.skillIds.length === 0 ? "all" : "ids";
    const targets: InstalledSkillTarget[] = [];

    if (mode === "all") {
      targets.push(...(await discoverInstalledSkillsFn(cwd, config.registryBaseUrl)));
    } else {
      const seenSkillIds = new Set<string>();
      for (const rawSkillId of parsed.skillIds) {
        const target = toInstalledSkillTarget(cwd, config.registryBaseUrl, rawSkillId);
        if (seenSkillIds.has(target.skillId)) {
          continue;
        }
        seenSkillIds.add(target.skillId);
        targets.push(target);
      }
    }

    if (targets.length === 0) {
      const emptyResult = toJsonResult(mode, []);
      if (parsed.json) {
        printJson(emptyResult);
      } else {
        printHumanResults([]);
      }
      return 0;
    }

    const entries: UpdateCommandEntry[] = [];

    for (const target of targets) {
      if (mode === "ids") {
        try {
          await access(target.installedPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            entries.push({
              skillId: target.skillId,
              status: "failed",
              reason: "skill is not installed in this project",
            });
            continue;
          }

          const message = error instanceof Error ? error.message : "unknown filesystem error";
          entries.push({
            skillId: target.skillId,
            status: "failed",
            reason: `unable to access installed skill path: ${message}`,
          });
          continue;
        }
      }

      let metadata;
      try {
        metadata = await readInstalledSkillMetadataFn(target.installedPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown metadata error";
        entries.push({
          skillId: target.skillId,
          status: "failed",
          reason: `invalid install metadata: ${message}`,
        });
        continue;
      }
      const fromVersion = metadata?.version;
      const intent = resolveUpdateIntent(metadata);

      if (intent.selector.strategy === "version") {
        const pinnedVersion = intent.selector.value;
        entries.push({
          skillId: target.skillId,
          fromVersion: fromVersion ?? pinnedVersion,
          toVersion: fromVersion ?? pinnedVersion,
          status: "skipped_pinned",
          reason: "version-pinned install",
        });
        continue;
      }

      try {
        const { result } = await installFromRegistryFn(
          {
            registryBaseUrl: config.registryBaseUrl,
            requestTimeoutMs: config.requestTimeoutMs,
            resolveReadIdToken: resolveReadIdTokenCached,
            cwd,
            ownerSlug: target.ownerSlug,
            skillSlug: target.skillSlug,
            selector: toSelector(intent),
            allowYanked: parsed.allowYanked,
            now,
            sourceCommandFactory: ({ canonicalSkillId }) => {
              const parts = ["skillmd", "update", canonicalSkillId];
              if (parsed.allowYanked) {
                parts.push("--allow-yanked");
              }
              return parts.join(" ");
            },
          },
          {},
        );

        entries.push({
          skillId: result.skillId,
          fromVersion,
          toVersion: result.version,
          status: "updated",
        });
      } catch (error) {
        entries.push({
          skillId: target.skillId,
          fromVersion,
          status: "failed",
          reason: toErrorReason(error),
        });
      }
    }

    if (parsed.json) {
      printJson(toJsonResult(mode, entries));
    } else {
      printHumanResults(entries);
    }

    const failures = entries.filter((entry) => entry.status === "failed").length;
    return failures > 0 ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd update: ${message}`);
    return 1;
  }
}
