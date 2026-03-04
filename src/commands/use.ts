import { parseSkillId } from "../lib/registry/skill-id";
import { DEFAULT_AGENT_TARGET } from "../lib/shared/agent-target";
import { failWithUsage } from "../lib/shared/command-output";
import { USE_USAGE } from "../lib/shared/cli-text";
import { printJson } from "../lib/shared/json-output";
import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { isUseApiError } from "../lib/use/errors";
import { parseUseFlags } from "../lib/use/flags";
import { type InstallSelector, type UseCommandResult } from "../lib/use/types";
import {
  installFromRegistry as defaultInstallFromRegistry,
  type UseWorkflowDependencies,
} from "../lib/use/workflow";
import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { upsertInstalledLockEntry } from "../lib/shared/lock-entry";
import {
  loadSkillsLock as defaultLoadSkillsLock,
  saveSkillsLock as defaultSaveSkillsLock,
} from "../lib/workspace/skills-lock";

interface UseCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  installFromRegistry?: typeof defaultInstallFromRegistry;
  resolveVersion?: UseWorkflowDependencies["resolveVersion"];
  getArtifactDescriptor?: UseWorkflowDependencies["getArtifactDescriptor"];
  downloadArtifact?: UseWorkflowDependencies["downloadArtifact"];
  installArtifact?: UseWorkflowDependencies["installArtifact"];
  resolveReadIdToken?: () => Promise<string | null>;
  loadSkillsLock?: typeof defaultLoadSkillsLock;
  saveSkillsLock?: typeof defaultSaveSkillsLock;
}

function printHumanResult(result: UseCommandResult, warnings: string[]): void {
  for (const warning of warnings) {
    console.error(`Warning: ${warning}`);
  }
  console.log(
    `Installed ${result.skillId}@${result.version} to ${result.installedPath} (digest=${result.digest}).`,
  );
  console.log(`Next: skillmd history ${result.skillId} --limit 20`);
}

export async function runUseCommand(
  args: string[],
  options: UseCommandOptions = {},
): Promise<number> {
  const parsed = parseUseFlags(args);
  if (!parsed.valid || !parsed.skillId) {
    return failWithUsage("skillmd use: unsupported argument(s)", USE_USAGE);
  }

  try {
    const parsedSkillId = parseSkillId(parsed.skillId);
    const env = options.env ?? process.env;
    const now = options.now ?? (() => new Date());
    const cwd = options.cwd ?? process.cwd();
    const getConfigFn = options.getConfig ?? getUseEnvConfig;
    const installFromRegistryFn = options.installFromRegistry ?? defaultInstallFromRegistry;
    const loadSkillsLockFn = options.loadSkillsLock ?? defaultLoadSkillsLock;
    const saveSkillsLockFn = options.saveSkillsLock ?? defaultSaveSkillsLock;
    const config = getConfigFn(env);
    const resolveReadIdTokenFn =
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }));
    const selector: InstallSelector = parsed.version
      ? { strategy: "version", version: parsed.version }
      : { strategy: "spec", spec: parsed.spec ?? "latest" };

    const workflow = await installFromRegistryFn(
      {
        registryBaseUrl: config.registryBaseUrl,
        requestTimeoutMs: config.requestTimeoutMs,
        resolveReadIdToken: resolveReadIdTokenFn,
        cwd,
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        selector,
        selectedAgentTarget: parsed.agentTarget,
        defaultAgentTarget: config.defaultAgentTarget ?? DEFAULT_AGENT_TARGET,
        now,
        sourceCommandFactory: ({ canonicalSkillId, resolvedAgentTarget }) => {
          const parts = ["skillmd", "use", canonicalSkillId];
          if (parsed.version) {
            parts.push("--version", parsed.version);
          } else if (parsed.spec) {
            parts.push("--spec", parsed.spec);
          }
          if (parsed.agentTarget) {
            parts.push("--agent-target", parsed.agentTarget);
          } else if (resolvedAgentTarget !== DEFAULT_AGENT_TARGET) {
            parts.push("--agent-target", resolvedAgentTarget);
          }
          return parts.join(" ");
        },
      },
      {
        resolveVersion: options.resolveVersion,
        getArtifactDescriptor: options.getArtifactDescriptor,
        downloadArtifact: options.downloadArtifact,
        installArtifact: options.installArtifact,
      },
    );
    const { result, lockEntry } = workflow;
    const warnings = workflow.warnings ?? [];
    const lock = await loadSkillsLockFn(cwd);
    const nextLock = upsertInstalledLockEntry(lock, lockEntry, now());
    await saveSkillsLockFn(cwd, nextLock);

    if (parsed.json) {
      printJson({
        ...result,
        warnings,
      } as unknown as Record<string, unknown>);
      return 0;
    }

    printHumanResult(result, warnings);
    return 0;
  } catch (error) {
    if (isUseApiError(error)) {
      console.error(`skillmd use: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd use: ${message}`);
    return 1;
  }
}
