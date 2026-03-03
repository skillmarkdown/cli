import { promises as fs } from "node:fs";

import { parseSkillId } from "../lib/registry/skill-id";
import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { isUseApiError } from "../lib/use/errors";
import { type InstallSelector } from "../lib/use/types";
import { installFromRegistry as defaultInstallFromRegistry } from "../lib/use/workflow";
import { DEFAULT_AGENT_TARGET, type AgentTarget } from "../lib/shared/agent-target";
import { parseUpdateFlags } from "../lib/update/flags";
import { resolveUpdateIntent } from "../lib/update/intent";
import {
  type SkillsLockEntry,
  type UpdateCommandEntry,
  type UpdateJsonEntry,
  type UpdateJsonResult,
  type UpdateMode,
} from "../lib/update/types";
import { failWithUsage } from "../lib/shared/command-output";
import { UPDATE_USAGE } from "../lib/shared/cli-text";
import { renderTable } from "../lib/shared/table";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import {
  listSkillsLockEntries,
  loadSkillsLock as defaultLoadSkillsLock,
  removeSkillsLockEntry,
  resolveRegistryHost,
  saveSkillsLock as defaultSaveSkillsLock,
  upsertSkillsLockEntry,
  type SkillsLockFile,
} from "../lib/workspace/skills-lock";

interface UpdateCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  installFromRegistry?: typeof defaultInstallFromRegistry;
  loadSkillsLock?: typeof defaultLoadSkillsLock;
  saveSkillsLock?: typeof defaultSaveSkillsLock;
  access?: typeof fs.access;
  resolveReadIdToken?: () => Promise<string | null>;
}

interface SelectedLockEntry {
  key: string;
  entry: SkillsLockEntry;
}

function printJson(payload: UpdateJsonResult): void {
  console.log(JSON.stringify(payload, null, 2));
}

function toSelector(spec: string): InstallSelector {
  return {
    strategy: "spec",
    spec,
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
      agentTarget: entry.agentTarget,
      installedPath: entry.installedPath,
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
        header: "TARGET",
        width: 10,
        value: (row) => row.agentTarget ?? "-",
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

function dedupeByKey(entries: SelectedLockEntry[]): SelectedLockEntry[] {
  const byKey = new Map<string, SelectedLockEntry>();
  for (const entry of entries) {
    byKey.set(entry.key, entry);
  }
  return Array.from(byKey.values());
}

function selectAllEntries(
  lock: SkillsLockFile,
  registryBaseUrl: string,
  selectedAgentTarget?: AgentTarget,
): SelectedLockEntry[] {
  const host = resolveRegistryHost(registryBaseUrl);
  return listSkillsLockEntries(lock)
    .filter(({ entry }) => {
      try {
        return resolveRegistryHost(entry.registryBaseUrl) === host;
      } catch {
        return false;
      }
    })
    .filter(({ entry }) => (selectedAgentTarget ? entry.agentTarget === selectedAgentTarget : true))
    .sort(
      (left, right) =>
        left.entry.skillId.localeCompare(right.entry.skillId) ||
        left.entry.installedPath.localeCompare(right.entry.installedPath),
    );
}

function selectBySkillIds(
  lock: SkillsLockFile,
  rawSkillIds: string[],
  registryBaseUrl: string,
  selectedAgentTarget: AgentTarget | undefined,
): {
  selected: SelectedLockEntry[];
  missing: Array<{ skillId: string; agentTarget?: AgentTarget }>;
} {
  const host = resolveRegistryHost(registryBaseUrl);
  const selected: SelectedLockEntry[] = [];
  const missing: Array<{ skillId: string; agentTarget?: AgentTarget }> = [];
  const parsedSkillIds = rawSkillIds.map((rawSkillId) => parseSkillId(rawSkillId).skillId);
  const uniqueSkillIds = Array.from(new Set(parsedSkillIds));

  for (const skillId of uniqueSkillIds) {
    const matches = listSkillsLockEntries(lock)
      .filter(({ entry }) => entry.skillId === skillId)
      .filter(({ entry }) => {
        try {
          return resolveRegistryHost(entry.registryBaseUrl) === host;
        } catch {
          return false;
        }
      })
      .filter(({ entry }) =>
        selectedAgentTarget ? entry.agentTarget === selectedAgentTarget : true,
      );

    if (matches.length === 0) {
      missing.push({ skillId, agentTarget: selectedAgentTarget });
      continue;
    }
    selected.push(...matches);
  }

  return { selected: dedupeByKey(selected), missing };
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
  const installFromRegistryFn = options.installFromRegistry ?? defaultInstallFromRegistry;
  const loadSkillsLockFn = options.loadSkillsLock ?? defaultLoadSkillsLock;
  const saveSkillsLockFn = options.saveSkillsLock ?? defaultSaveSkillsLock;
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
    const explicitEnvAgentTarget =
      typeof env.SKILLMD_AGENT_TARGET === "string" && env.SKILLMD_AGENT_TARGET.trim().length > 0;
    const selectedAgentTarget =
      parsed.agentTarget ??
      (explicitEnvAgentTarget ? (config.defaultAgentTarget as AgentTarget) : undefined);
    const mode: UpdateMode = parsed.all || parsed.skillIds.length === 0 ? "all" : "ids";
    let lock = await loadSkillsLockFn(cwd);
    const entries: UpdateCommandEntry[] = [];

    const selectedResult =
      mode === "all"
        ? {
            selected: selectAllEntries(lock, config.registryBaseUrl, selectedAgentTarget),
            missing: [],
          }
        : selectBySkillIds(lock, parsed.skillIds, config.registryBaseUrl, selectedAgentTarget);

    for (const missing of selectedResult.missing) {
      entries.push({
        skillId: missing.skillId,
        agentTarget: missing.agentTarget,
        status: "failed",
        reason: "skill is not installed in this project",
      });
    }

    if (selectedResult.selected.length === 0 && entries.length === 0) {
      const emptyResult = toJsonResult(mode, []);
      if (parsed.json) {
        printJson(emptyResult);
      } else {
        printHumanResults([]);
      }
      return 0;
    }

    for (const selected of selectedResult.selected) {
      const entry = selected.entry;
      try {
        await access(entry.installedPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          entries.push({
            skillId: entry.skillId,
            agentTarget: entry.agentTarget as AgentTarget,
            installedPath: entry.installedPath,
            fromVersion: entry.resolvedVersion,
            status: "failed",
            reason: "skill is not installed in this project",
          });
          lock = removeSkillsLockEntry(lock, selected.key, now());
          continue;
        }

        const message = error instanceof Error ? error.message : "unknown filesystem error";
        entries.push({
          skillId: entry.skillId,
          agentTarget: entry.agentTarget as AgentTarget,
          installedPath: entry.installedPath,
          fromVersion: entry.resolvedVersion,
          status: "failed",
          reason: `unable to access installed skill path: ${message}`,
        });
        continue;
      }

      const intent = resolveUpdateIntent(entry);
      if (intent.selector.strategy === "version") {
        entries.push({
          skillId: entry.skillId,
          agentTarget: entry.agentTarget as AgentTarget,
          installedPath: entry.installedPath,
          fromVersion: entry.resolvedVersion,
          toVersion: entry.resolvedVersion,
          status: "skipped_pinned",
          reason: "version-pinned install",
        });
        continue;
      }

      const parsedSkillId = parseSkillId(entry.skillId);
      try {
        const { result, lockEntry } = await installFromRegistryFn(
          {
            registryBaseUrl: config.registryBaseUrl,
            requestTimeoutMs: config.requestTimeoutMs,
            resolveReadIdToken: resolveReadIdTokenCached,
            cwd,
            ownerSlug: parsedSkillId.ownerSlug,
            skillSlug: parsedSkillId.skillSlug,
            selector: toSelector(intent.selector.value),
            selectedAgentTarget: entry.agentTarget as AgentTarget,
            defaultAgentTarget: config.defaultAgentTarget ?? DEFAULT_AGENT_TARGET,
            allowYanked: parsed.allowYanked,
            now,
            sourceCommandFactory: ({ canonicalSkillId }) => {
              const parts = ["skillmd", "update", canonicalSkillId];
              if (entry.agentTarget !== DEFAULT_AGENT_TARGET) {
                parts.push("--agent-target", entry.agentTarget);
              }
              if (parsed.allowYanked) {
                parts.push("--allow-yanked");
              }
              return parts.join(" ");
            },
          },
          {},
        );

        lock = upsertSkillsLockEntry(
          lock,
          {
            skillId: lockEntry.skillId,
            ownerLogin: lockEntry.ownerLogin,
            skill: lockEntry.skill,
            agentTarget: lockEntry.agentTarget,
            selectorSpec: entry.selectorSpec,
            resolvedVersion: lockEntry.version,
            digest: lockEntry.digest,
            sizeBytes: lockEntry.sizeBytes,
            mediaType: lockEntry.mediaType,
            installedPath: lockEntry.installedPath,
            registryBaseUrl: lockEntry.registryBaseUrl,
            installedAt: lockEntry.installedAt,
            sourceCommand: lockEntry.sourceCommand,
            downloadedFrom: lockEntry.downloadedFrom,
          },
          now(),
        );

        entries.push({
          skillId: result.skillId,
          agentTarget: entry.agentTarget as AgentTarget,
          installedPath: result.installedPath,
          fromVersion: entry.resolvedVersion,
          toVersion: result.version,
          status: "updated",
        });
      } catch (error) {
        entries.push({
          skillId: entry.skillId,
          agentTarget: entry.agentTarget as AgentTarget,
          installedPath: entry.installedPath,
          fromVersion: entry.resolvedVersion,
          status: "failed",
          reason: toErrorReason(error),
        });
      }
    }

    await saveSkillsLockFn(cwd, lock);

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
