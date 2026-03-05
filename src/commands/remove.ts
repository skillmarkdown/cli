import { promises as fs } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { parseSkillId } from "../lib/registry/skill-id";
import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { type AgentTarget, normalizeAgentTarget } from "../lib/shared/agent-target";
import { failWithUsage } from "../lib/shared/command-output";
import { REMOVE_USAGE } from "../lib/shared/cli-text";
import { printJson } from "../lib/shared/json-output";
import {
  listSkillsLockEntries,
  loadSkillsLock as defaultLoadSkillsLock,
  removeSkillsLockEntry,
  resolveRegistryHost,
  saveSkillsLock as defaultSaveSkillsLock,
  type SkillsLockEntry,
  type SkillsLockFile,
} from "../lib/workspace/skills-lock";
import { resolveInstalledSkillPath } from "../lib/use/pathing";

interface RemoveCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  loadSkillsLock?: typeof defaultLoadSkillsLock;
  saveSkillsLock?: typeof defaultSaveSkillsLock;
  removePath?: (path: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
}

interface ParsedRemoveFlags {
  valid: boolean;
  skillId?: string;
  json: boolean;
  agentTarget?: AgentTarget;
}

function parseRemoveFlags(args: string[]): ParsedRemoveFlags {
  if (args.length === 0) return { valid: false, json: false };
  let skillId: string | undefined;
  let json = false;
  let agentTarget: AgentTarget | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--") && !skillId) {
      try {
        skillId = parseSkillId(arg).skillId;
      } catch {
        return { valid: false, json: false };
      }
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--agent-target") {
      const value = args[index + 1];
      if (!value) return { valid: false, json: false };
      const parsed = normalizeAgentTarget(value);
      if (!parsed) return { valid: false, json: false };
      agentTarget = parsed;
      index += 1;
      continue;
    }
    if (arg.startsWith("--agent-target=")) {
      const parsed = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsed) return { valid: false, json: false };
      agentTarget = parsed;
      continue;
    }
    return { valid: false, json: false };
  }
  return { valid: Boolean(skillId), skillId, json, agentTarget };
}

function validateCanonicalPath(cwd: string, entry: SkillsLockEntry): true | string {
  try {
    const parsedSkillId = parseSkillId(entry.skillId);
    const expectedPath = resolveInstalledSkillPath(
      cwd,
      entry.registryBaseUrl,
      parsedSkillId.ownerSlug,
      parsedSkillId.skillSlug,
      entry.agentTarget,
    );
    return resolvePath(expectedPath) === resolvePath(entry.installedPath)
      ? true
      : "refusing to remove non-canonical install path";
  } catch (error) {
    return error instanceof Error ? error.message : "invalid lock entry";
  }
}

function selectMatches(
  lock: SkillsLockFile,
  skillId: string,
  registryBaseUrl: string,
  agentTarget?: AgentTarget,
): Array<{ key: string; entry: SkillsLockEntry }> {
  const host = resolveRegistryHost(registryBaseUrl);
  return listSkillsLockEntries(lock)
    .filter(({ entry }) => entry.skillId === skillId)
    .filter(({ entry }) => {
      try {
        return resolveRegistryHost(entry.registryBaseUrl) === host;
      } catch {
        return false;
      }
    })
    .filter(({ entry }) => (agentTarget ? entry.agentTarget === agentTarget : true));
}

export async function runRemoveCommand(
  args: string[],
  options: RemoveCommandOptions = {},
): Promise<number> {
  const parsed = parseRemoveFlags(args);
  if (!parsed.valid || !parsed.skillId) {
    return failWithUsage("skillmd remove: unsupported argument(s)", REMOVE_USAGE);
  }

  try {
    const cwd = options.cwd ?? process.cwd();
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getUseEnvConfig)(env);
    const removePath = options.removePath ?? fs.rm.bind(fs);
    let lock = await (options.loadSkillsLock ?? defaultLoadSkillsLock)(cwd);
    const matches = selectMatches(lock, parsed.skillId, config.registryBaseUrl, parsed.agentTarget);

    if (matches.length === 0) {
      console.error("skillmd remove: skill is not installed in this project");
      return 1;
    }

    const removed: string[] = [];
    const failed: Array<{ key: string; reason: string }> = [];
    for (const match of matches) {
      const canonical = validateCanonicalPath(cwd, match.entry);
      if (canonical !== true) {
        failed.push({ key: match.entry.skillId, reason: canonical });
        continue;
      }
      try {
        await removePath(match.entry.installedPath, { recursive: true, force: true });
        lock = removeSkillsLockEntry(lock, match.key);
        removed.push(match.entry.installedPath);
      } catch (error) {
        failed.push({
          key: match.entry.skillId,
          reason: error instanceof Error ? error.message : "unable to remove installed path",
        });
      }
    }

    await (options.saveSkillsLock ?? defaultSaveSkillsLock)(cwd, lock);

    if (parsed.json) {
      printJson({ removed: removed.length, failed });
    } else {
      console.log(`Removed ${removed.length} install(s) for ${parsed.skillId}.`);
      if (failed.length > 0) {
        for (const failure of failed) console.error(`remove failed: ${failure.reason}`);
      }
    }
    return failed.length > 0 ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd remove: ${message}`);
    return 1;
  }
}
