import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { type AgentTarget, normalizeAgentTarget } from "../lib/shared/agent-target";
import { failWithUsage } from "../lib/shared/command-output";
import { LIST_USAGE } from "../lib/shared/cli-text";
import { printJson } from "../lib/shared/json-output";
import { renderTable } from "../lib/shared/table";
import { resolveTableMaxWidth } from "../lib/shared/install-update-output";
import {
  listSkillsLockEntries,
  loadSkillsLock as defaultLoadSkillsLock,
  resolveRegistryHost,
  type SkillsLockEntry,
} from "../lib/workspace/skills-lock";

interface ListCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  loadSkillsLock?: typeof defaultLoadSkillsLock;
}

interface ParsedListFlags {
  valid: boolean;
  json: boolean;
  agentTarget?: AgentTarget;
}

function parseListFlags(args: string[]): ParsedListFlags {
  let json = false;
  let agentTarget: AgentTarget | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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
  return { valid: true, json, agentTarget };
}

function toListRow(entry: SkillsLockEntry): {
  skillId: string;
  agentTarget: string;
  version: string;
  spec: string;
  installedPath: string;
} {
  return {
    skillId: entry.skillId,
    agentTarget: entry.agentTarget,
    version: entry.resolvedVersion,
    spec: entry.selectorSpec,
    installedPath: entry.installedPath,
  };
}

function printListTable(rows: Array<ReturnType<typeof toListRow>>): void {
  const lines = renderTable(
    [
      {
        header: "SKILL",
        minWidth: 26,
        maxWidth: 48,
        shrinkPriority: 0,
        wrap: true,
        maxLines: 2,
        value: (row: { skillId: string }) => row.skillId,
      },
      { header: "TARGET", width: 10, value: (row: { agentTarget: string }) => row.agentTarget },
      { header: "VERSION", width: 14, value: (row: { version: string }) => row.version },
      { header: "SPEC", width: 14, value: (row: { spec: string }) => row.spec },
      {
        header: "PATH",
        minWidth: 18,
        maxWidth: 64,
        shrinkPriority: 4,
        value: (row: { installedPath: string }) => row.installedPath,
      },
    ],
    rows,
    { maxWidth: resolveTableMaxWidth() },
  );
  for (const line of lines) console.log(line);
}

export async function runListCommand(
  args: string[],
  options: ListCommandOptions = {},
): Promise<number> {
  const parsed = parseListFlags(args);
  if (!parsed.valid) return failWithUsage("skillmd list: unsupported argument(s)", LIST_USAGE);

  try {
    const cwd = options.cwd ?? process.cwd();
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getUseEnvConfig)(env);
    const lock = await (options.loadSkillsLock ?? defaultLoadSkillsLock)(cwd);
    const host = resolveRegistryHost(config.registryBaseUrl);
    const rows = listSkillsLockEntries(lock)
      .filter(({ entry }) => {
        try {
          return resolveRegistryHost(entry.registryBaseUrl) === host;
        } catch {
          return false;
        }
      })
      .filter(({ entry }) => (parsed.agentTarget ? entry.agentTarget === parsed.agentTarget : true))
      .map(({ entry }) => toListRow(entry))
      .sort(
        (a, b) => a.skillId.localeCompare(b.skillId) || a.agentTarget.localeCompare(b.agentTarget),
      );

    if (parsed.json) {
      printJson({ total: rows.length, entries: rows });
    } else if (rows.length === 0) {
      console.log("No installed skills found.");
    } else {
      printListTable(rows);
      console.log(`Summary: total=${rows.length}`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd list: ${message}`);
    return 1;
  }
}
