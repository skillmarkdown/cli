import { promises as fs } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { parseInstallFlags } from "../lib/install/flags";
import {
  type InstallCommandEntry,
  type InstallJsonResult,
  type InstallPrunedEntry,
} from "../lib/install/types";
import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { DEFAULT_AGENT_TARGET, type AgentTarget } from "../lib/shared/agent-target";
import { failWithUsage, printSummary, printWarnings } from "../lib/shared/command-output";
import { INSTALL_USAGE } from "../lib/shared/cli-text";
import { printJson } from "../lib/shared/json-output";
import { upsertInstalledLockEntry } from "../lib/shared/lock-entry";
import { parseSkillId } from "../lib/registry/skill-id";
import { createCachedReadTokenResolver } from "../lib/shared/read-token-cache";
import {
  listSkillsLockEntries,
  loadSkillsLock as defaultLoadSkillsLock,
  removeSkillsLockEntry,
  resolveRegistryHost,
  saveSkillsLock as defaultSaveSkillsLock,
  type SkillsLockEntry,
  type SkillsLockFile,
} from "../lib/workspace/skills-lock";
import {
  loadSkillsManifest as defaultLoadSkillsManifest,
  type SkillsManifestDependency,
  type SkillsManifestFile,
} from "../lib/workspace/skills-manifest";
import {
  countByStatus,
  printPruneTable,
  printSkillStatusTable,
  toUseApiErrorReason,
} from "../lib/shared/install-update-output";
import {
  resolveInstalledSkillPath,
  resolveLegacyFlatInstalledSkillPath,
  resolveLegacyInstalledSkillPath,
} from "../lib/use/pathing";
import { installFromRegistry as defaultInstallFromRegistry } from "../lib/use/workflow";

interface InstallCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  loadSkillsManifest?: typeof defaultLoadSkillsManifest;
  loadSkillsLock?: typeof defaultLoadSkillsLock;
  saveSkillsLock?: typeof defaultSaveSkillsLock;
  installFromRegistry?: typeof defaultInstallFromRegistry;
  resolveReadIdToken?: () => Promise<string | null>;
  removePath?: (path: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
}

function toJsonResult(
  entries: InstallCommandEntry[],
  pruneEntries: InstallPrunedEntry[] | undefined,
): InstallJsonResult {
  const installed = entries.filter((entry) => entry.status === "installed");
  const skipped = entries.filter((entry) => entry.status === "skipped");
  const failed = entries.filter((entry) => entry.status === "failed");
  const payload: InstallJsonResult = {
    total: entries.length,
    installed,
    skipped,
    failed,
  };
  if (pruneEntries) {
    payload.pruned = pruneEntries;
  }
  return payload;
}

function printHuman(
  entries: InstallCommandEntry[],
  pruneEntries: InstallPrunedEntry[] | undefined,
): void {
  if (entries.length === 0) {
    console.log("No skills were processed.");
  } else {
    printSkillStatusTable(entries, { includeSpec: true });
  }
  const installed = countByStatus(entries, "installed");
  const skipped = countByStatus(entries, "skipped");
  const failed = countByStatus(entries, "failed");
  printSummary("Summary", [
    `total=${entries.length}`,
    `installed=${installed}`,
    `skipped=${skipped}`,
    `failed=${failed}`,
  ]);

  if (pruneEntries) {
    printPruneTable(pruneEntries);
    const pruned = countByStatus(pruneEntries, "pruned");
    const pruneFailed = countByStatus(pruneEntries, "failed");
    printSummary("Prune summary", [
      `total=${pruneEntries.length}`,
      `pruned=${pruned}`,
      `failed=${pruneFailed}`,
    ]);
  }
}

function buildDesiredKey(skillId: string, agentTarget: AgentTarget, registryHost: string): string {
  return `${skillId}|${agentTarget}|${registryHost}`;
}

function validatePrunePath(
  cwd: string,
  entry: SkillsLockEntry,
): { valid: true } | { valid: false; reason: string } {
  let expectedPath: string;
  let legacyPath: string;
  let legacyFlatPath: string;
  try {
    const parsedSkillId = parseSkillId(entry.skillId);
    expectedPath = resolveInstalledSkillPath(
      cwd,
      entry.registryBaseUrl,
      parsedSkillId.username,
      parsedSkillId.skillSlug,
      entry.agentTarget,
    );
    legacyPath = resolveLegacyInstalledSkillPath(
      cwd,
      entry.registryBaseUrl,
      parsedSkillId.username,
      parsedSkillId.skillSlug,
      entry.agentTarget,
    );
    legacyFlatPath = resolveLegacyFlatInstalledSkillPath(
      cwd,
      entry.registryBaseUrl,
      parsedSkillId.username,
      parsedSkillId.skillSlug,
      entry.agentTarget,
    );
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "invalid lock entry skill id",
    };
  }

  const resolvedInstalledPath = resolvePath(entry.installedPath);
  if (
    resolvedInstalledPath !== resolvePath(expectedPath) &&
    resolvedInstalledPath !== resolvePath(legacyPath) &&
    resolvedInstalledPath !== resolvePath(legacyFlatPath)
  ) {
    return {
      valid: false,
      reason: "refusing to prune non-canonical install path",
    };
  }

  return { valid: true };
}

function findMatchingLockEntry(
  lock: SkillsLockFile,
  skillId: string,
  agentTarget: AgentTarget,
  registryHost: string,
): SkillsLockEntry | null {
  for (const { entry } of listSkillsLockEntries(lock)) {
    try {
      if (
        entry.skillId === skillId &&
        entry.agentTarget === agentTarget &&
        resolveRegistryHost(entry.registryBaseUrl) === registryHost
      ) {
        return entry;
      }
    } catch {
      // Ignore malformed lock entries.
    }
  }

  return null;
}

function resolveAgentTargetForDependency(
  dependency: SkillsManifestDependency,
  manifest: SkillsManifestFile,
  globalTarget: AgentTarget | undefined,
  configTarget: AgentTarget,
): AgentTarget {
  return (
    globalTarget ??
    dependency.agentTarget ??
    manifest.defaults.agentTarget ??
    configTarget ??
    DEFAULT_AGENT_TARGET
  );
}

function buildSourceCommand(prune: boolean, globalTarget: AgentTarget | undefined): string {
  const parts = ["skillmd", "install"];
  if (prune) {
    parts.push("--prune");
  }
  if (globalTarget) {
    parts.push("--agent-target", globalTarget);
  }
  return parts.join(" ");
}

function selectPruneCandidates(
  lock: SkillsLockFile,
  registryHost: string,
  desiredKeys: Set<string>,
): Array<{ key: string; entry: SkillsLockEntry }> {
  return listSkillsLockEntries(lock)
    .filter(({ entry }) => {
      try {
        return resolveRegistryHost(entry.registryBaseUrl) === registryHost;
      } catch {
        return false;
      }
    })
    .filter(
      ({ entry }) =>
        !desiredKeys.has(buildDesiredKey(entry.skillId, entry.agentTarget, registryHost)),
    )
    .sort((left, right) => {
      return (
        left.entry.skillId.localeCompare(right.entry.skillId) ||
        left.entry.agentTarget.localeCompare(right.entry.agentTarget)
      );
    });
}

export async function runInstallCommand(
  args: string[],
  options: InstallCommandOptions = {},
): Promise<number> {
  const parsed = parseInstallFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd install: unsupported argument(s)", INSTALL_USAGE);
  }

  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const getConfigFn = options.getConfig ?? getUseEnvConfig;
  const loadSkillsManifestFn = options.loadSkillsManifest ?? defaultLoadSkillsManifest;
  const loadSkillsLockFn = options.loadSkillsLock ?? defaultLoadSkillsLock;
  const saveSkillsLockFn = options.saveSkillsLock ?? defaultSaveSkillsLock;
  const installFromRegistryFn = options.installFromRegistry ?? defaultInstallFromRegistry;
  const resolveReadIdTokenFn =
    options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }));
  const removePathFn = options.removePath ?? fs.rm.bind(fs);
  const resolveReadIdTokenCached = createCachedReadTokenResolver(resolveReadIdTokenFn);

  try {
    const config = getConfigFn(env);
    const manifest = await loadSkillsManifestFn(cwd);
    let lock = await loadSkillsLockFn(cwd);
    const registryHost = resolveRegistryHost(config.registryBaseUrl);
    const entries: InstallCommandEntry[] = [];
    const sourceCommand = buildSourceCommand(parsed.prune, parsed.agentTarget);
    const desiredKeys = new Set<string>();

    for (const dependency of manifest.dependencies) {
      const parsedSkill = parseSkillId(dependency.skillId);
      const resolvedTarget = resolveAgentTargetForDependency(
        dependency,
        manifest,
        parsed.agentTarget,
        config.defaultAgentTarget ?? DEFAULT_AGENT_TARGET,
      );
      desiredKeys.add(buildDesiredKey(dependency.skillId, resolvedTarget, registryHost));

      const existingEntry = findMatchingLockEntry(
        lock,
        dependency.skillId,
        resolvedTarget,
        registryHost,
      );

      try {
        const workflow = await installFromRegistryFn(
          {
            registryBaseUrl: config.registryBaseUrl,
            requestTimeoutMs: config.requestTimeoutMs,
            resolveReadIdToken: resolveReadIdTokenCached,
            cwd,
            username: parsedSkill.username,
            skillSlug: parsedSkill.skillSlug,
            preferBareSkillId: parsedSkill.username.length === 0,
            selector: {
              strategy: "spec",
              spec: dependency.spec,
            },
            selectedAgentTarget: resolvedTarget,
            defaultAgentTarget: config.defaultAgentTarget ?? DEFAULT_AGENT_TARGET,
            now,
            sourceCommandFactory: () => sourceCommand,
          },
          {},
        );

        printWarnings(
          (workflow.warnings ?? []).map((warning) => `${dependency.skillId}: ${warning}`),
        );

        const { lockEntry, result } = workflow;
        lock = upsertInstalledLockEntry(lock, lockEntry, now(), dependency.spec);

        entries.push({
          skillId: dependency.skillId,
          agentTarget: resolvedTarget,
          spec: dependency.spec,
          fromVersion: existingEntry?.resolvedVersion,
          toVersion: result.version,
          installedPath: result.installedPath,
          status: "installed",
          reason: workflow.warnings.length > 0 ? workflow.warnings.join(" | ") : undefined,
        });
      } catch (error) {
        entries.push({
          skillId: dependency.skillId,
          agentTarget: resolvedTarget,
          spec: dependency.spec,
          fromVersion: existingEntry?.resolvedVersion,
          status: "failed",
          reason: toUseApiErrorReason(error),
        });
      }
    }

    let pruneEntries: InstallPrunedEntry[] | undefined;
    if (parsed.prune) {
      pruneEntries = [];
      const candidates = selectPruneCandidates(lock, registryHost, desiredKeys);
      for (const candidate of candidates) {
        const prunePathValidation = validatePrunePath(cwd, candidate.entry);
        if (!prunePathValidation.valid) {
          pruneEntries.push({
            skillId: candidate.entry.skillId,
            agentTarget: candidate.entry.agentTarget,
            installedPath: candidate.entry.installedPath,
            status: "failed",
            reason: prunePathValidation.reason,
          });
          continue;
        }

        try {
          await removePathFn(candidate.entry.installedPath, { recursive: true, force: true });
          lock = removeSkillsLockEntry(lock, candidate.key, now());
          pruneEntries.push({
            skillId: candidate.entry.skillId,
            agentTarget: candidate.entry.agentTarget,
            installedPath: candidate.entry.installedPath,
            status: "pruned",
          });
        } catch (error) {
          pruneEntries.push({
            skillId: candidate.entry.skillId,
            agentTarget: candidate.entry.agentTarget,
            installedPath: candidate.entry.installedPath,
            status: "failed",
            reason: error instanceof Error ? error.message : "unable to prune installed path",
          });
        }
      }
    }

    await saveSkillsLockFn(cwd, lock);

    const jsonResult = toJsonResult(entries, pruneEntries);
    if (parsed.json) {
      printJson(jsonResult);
    } else {
      printHuman(entries, pruneEntries);
    }

    const failedInstalls = jsonResult.failed.length;
    const failedPrunes = pruneEntries
      ? pruneEntries.filter((entry) => entry.status === "failed").length
      : 0;
    return failedInstalls + failedPrunes > 0 ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.startsWith("skills manifest not found:")) {
      console.error(
        "skillmd install: skills.json not found in current directory. " +
          "Use 'skillmd use <skill-id>' for ad hoc installs, or create skills.json for workspace installs.",
      );
      return 1;
    }
    console.error(`skillmd install: ${message}`);
    return 1;
  }
}
