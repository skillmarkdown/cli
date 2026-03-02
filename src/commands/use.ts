import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import { USE_USAGE } from "../lib/shared/cli-text";
import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { isUseApiError } from "../lib/use/errors";
import { parseUseFlags } from "../lib/use/flags";
import { type InstallSelector, type UseCommandResult } from "../lib/use/types";
import {
  installFromRegistry as defaultInstallFromRegistry,
  type UseWorkflowDependencies,
} from "../lib/use/workflow";

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
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function printHumanResult(result: UseCommandResult): void {
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
    const config = getConfigFn(env);
    const selector: InstallSelector = parsed.version
      ? { strategy: "version", version: parsed.version }
      : parsed.channel
        ? { strategy: "channel", channel: parsed.channel }
        : { strategy: "latest_fallback_beta" };

    const { result } = await installFromRegistryFn(
      {
        registryBaseUrl: config.registryBaseUrl,
        requestTimeoutMs: config.requestTimeoutMs,
        cwd,
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        selector,
        allowYanked: parsed.allowYanked,
        now,
        sourceCommandFactory: ({ canonicalSkillId, resolvedChannel }) => {
          const parts = ["skillmd", "use", canonicalSkillId];
          if (parsed.version) {
            parts.push("--version", parsed.version);
          } else if (parsed.channel) {
            parts.push("--channel", parsed.channel);
          } else if (resolvedChannel === "beta") {
            parts.push("--channel", "beta");
          }
          if (parsed.allowYanked) {
            parts.push("--allow-yanked");
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

    if (parsed.json) {
      printJson(result as unknown as Record<string, unknown>);
      return 0;
    }

    printHumanResult(result);
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
