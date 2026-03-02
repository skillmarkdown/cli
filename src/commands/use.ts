import { type PublishChannel } from "../lib/publish/types";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import { USE_USAGE } from "../lib/shared/cli-text";
import { downloadArtifact, getArtifactDescriptor, resolveSkillVersion } from "../lib/use/client";
import { getUseEnvConfig, type UseEnvConfig } from "../lib/use/config";
import { isUseApiError } from "../lib/use/errors";
import { parseUseFlags } from "../lib/use/flags";
import { verifyDownloadedArtifact } from "../lib/use/integrity";
import { installSkillArtifact } from "../lib/use/install";
import { resolveInstallTempRoot, resolveInstalledSkillPath } from "../lib/use/pathing";
import {
  type ArtifactDescriptorResponse,
  type InstalledSkillMetadata,
  type ResolveSkillVersionResponse,
  type UseCommandResult,
} from "../lib/use/types";

interface UseCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  getConfig?: (env: NodeJS.ProcessEnv) => UseEnvConfig;
  resolveVersion?: (
    baseUrl: string,
    ownerSlug: string,
    skillSlug: string,
    channel: PublishChannel,
    options?: { timeoutMs?: number },
  ) => Promise<ResolveSkillVersionResponse>;
  getArtifactDescriptor?: (
    baseUrl: string,
    request: { ownerSlug: string; skillSlug: string; version: string },
    options?: { timeoutMs?: number },
  ) => Promise<ArtifactDescriptorResponse>;
  downloadArtifact?: (
    downloadUrl: string,
    options?: { timeoutMs?: number },
  ) => Promise<{ bytes: Buffer; downloadedFrom: string; contentType?: string }>;
  installArtifact?: (input: {
    targetPath: string;
    tempRoot: string;
    archiveBytes: Buffer;
    metadata: InstalledSkillMetadata;
  }) => Promise<void>;
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function buildSourceCommand(
  skillId: string,
  flags: { version?: string; channel?: PublishChannel; allowYanked: boolean },
): string {
  const parts = ["skillmd", "use", skillId];
  if (flags.version) {
    parts.push("--version", flags.version);
  } else if (flags.channel) {
    parts.push("--channel", flags.channel);
  }
  if (flags.allowYanked) {
    parts.push("--allow-yanked");
  }
  return parts.join(" ");
}

function sanitizeDownloadedFrom(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "redacted";
  }
}

function printHumanResult(result: UseCommandResult): void {
  console.log(
    `Installed ${result.skillId}@${result.version} to ${result.installedPath} (digest=${result.digest}).`,
  );
  console.log(`Next: skillmd history ${result.skillId} --limit 20`);
}

function shouldFallbackToBeta(error: unknown): boolean {
  if (!isUseApiError(error)) {
    return false;
  }

  if (error.status !== 404 || error.code !== "invalid_request") {
    return false;
  }

  return /channel not set/i.test(error.message);
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
    const resolveVersionFn = options.resolveVersion ?? resolveSkillVersion;
    const getArtifactDescriptorFn = options.getArtifactDescriptor ?? getArtifactDescriptor;
    const downloadArtifactFn = options.downloadArtifact ?? downloadArtifact;
    const installArtifactFn = options.installArtifact ?? installSkillArtifact;
    const config = getConfigFn(env);

    let selectedVersion = parsed.version;
    let resolvedChannel: PublishChannel | undefined = parsed.channel;
    if (!selectedVersion) {
      const requestedChannel = parsed.channel ?? "latest";
      try {
        const resolved = await resolveVersionFn(
          config.registryBaseUrl,
          parsedSkillId.ownerSlug,
          parsedSkillId.skillSlug,
          requestedChannel,
          { timeoutMs: config.requestTimeoutMs },
        );
        selectedVersion = resolved.version;
        resolvedChannel = resolved.channel;
      } catch (error) {
        if (!parsed.channel && shouldFallbackToBeta(error)) {
          const resolved = await resolveVersionFn(
            config.registryBaseUrl,
            parsedSkillId.ownerSlug,
            parsedSkillId.skillSlug,
            "beta",
            { timeoutMs: config.requestTimeoutMs },
          );
          selectedVersion = resolved.version;
          resolvedChannel = resolved.channel;
        } else {
          throw error;
        }
      }
    }

    const descriptor = await getArtifactDescriptorFn(
      config.registryBaseUrl,
      {
        ownerSlug: parsedSkillId.ownerSlug,
        skillSlug: parsedSkillId.skillSlug,
        version: selectedVersion,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    if (descriptor.yanked && !parsed.allowYanked) {
      throw new Error(
        `selected version is yanked. Re-run with --allow-yanked to proceed` +
          `${descriptor.yankedReason ? ` (${descriptor.yankedReason})` : ""}.`,
      );
    }

    const download = await downloadArtifactFn(descriptor.downloadUrl, {
      timeoutMs: config.requestTimeoutMs,
    });

    verifyDownloadedArtifact(descriptor, download.bytes, download.contentType);

    const canonicalSkillId = `@${descriptor.ownerLogin}/${descriptor.skill}`;
    const installedPath = resolveInstalledSkillPath(
      cwd,
      config.registryBaseUrl,
      descriptor.ownerLogin,
      descriptor.skill,
    );
    const installedAt = now().toISOString();

    const metadata: InstalledSkillMetadata = {
      skillId: canonicalSkillId,
      ownerLogin: descriptor.ownerLogin,
      skill: descriptor.skill,
      version: descriptor.version,
      digest: descriptor.digest,
      sizeBytes: descriptor.sizeBytes,
      mediaType: descriptor.mediaType,
      registryBaseUrl: config.registryBaseUrl,
      downloadedFrom: sanitizeDownloadedFrom(download.downloadedFrom),
      installedAt,
      sourceCommand: buildSourceCommand(canonicalSkillId, {
        version: parsed.version,
        channel: parsed.version ? undefined : resolvedChannel,
        allowYanked: parsed.allowYanked,
      }),
    };

    await installArtifactFn({
      targetPath: installedPath,
      tempRoot: resolveInstallTempRoot(cwd),
      archiveBytes: download.bytes,
      metadata,
    });

    const result: UseCommandResult = {
      skillId: canonicalSkillId,
      ownerLogin: descriptor.ownerLogin,
      skill: descriptor.skill,
      version: descriptor.version,
      digest: descriptor.digest,
      sizeBytes: descriptor.sizeBytes,
      mediaType: descriptor.mediaType,
      installedPath,
      registryBaseUrl: config.registryBaseUrl,
      installedAt,
      source: "registry",
    };

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
