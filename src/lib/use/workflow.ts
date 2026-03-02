import { type PublishChannel } from "../publish/types";
import { resolveInstalledSkillPath, resolveInstallTempRoot } from "./pathing";
import {
  downloadArtifact as defaultDownloadArtifact,
  getArtifactDescriptor as defaultGetArtifactDescriptor,
  resolveSkillVersion as defaultResolveSkillVersion,
} from "./client";
import { isUseApiError } from "./errors";
import { verifyDownloadedArtifact } from "./integrity";
import { installSkillArtifact as defaultInstallSkillArtifact } from "./install";
import {
  type ArtifactDescriptorResponse,
  type InstallIntent,
  type InstalledSkillMetadata,
  type InstallSelector,
  type InstallWorkflowResult,
  type ResolveSkillVersionResponse,
} from "./types";

export interface InstallWorkflowInput {
  registryBaseUrl: string;
  requestTimeoutMs: number;
  cwd: string;
  ownerSlug: string;
  skillSlug: string;
  selector: InstallSelector;
  allowYanked: boolean;
  sourceCommandFactory: (input: {
    canonicalSkillId: string;
    selector: InstallSelector;
    resolvedChannel?: PublishChannel;
  }) => string;
  now?: () => Date;
}

export interface UseWorkflowDependencies {
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

function shouldFallbackToBeta(error: unknown): boolean {
  if (!isUseApiError(error)) {
    return false;
  }

  if (error.status !== 404 || error.code !== "invalid_request") {
    return false;
  }

  return /channel not set/i.test(error.message);
}

function sanitizeDownloadedFrom(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "redacted";
  }
}

function toInstallIntent(selector: InstallSelector): InstallIntent {
  if (selector.strategy === "version") {
    return {
      strategy: "version",
      value: selector.version,
    };
  }

  if (selector.strategy === "channel") {
    return {
      strategy: "channel",
      value: selector.channel,
    };
  }

  return {
    strategy: "latest_fallback_beta",
    value: null,
  };
}

export async function installFromRegistry(
  input: InstallWorkflowInput,
  dependencies: UseWorkflowDependencies = {},
): Promise<InstallWorkflowResult> {
  const resolveVersionFn = dependencies.resolveVersion ?? defaultResolveSkillVersion;
  const getArtifactDescriptorFn =
    dependencies.getArtifactDescriptor ?? defaultGetArtifactDescriptor;
  const downloadArtifactFn = dependencies.downloadArtifact ?? defaultDownloadArtifact;
  const installArtifactFn = dependencies.installArtifact ?? defaultInstallSkillArtifact;
  const now = input.now ?? (() => new Date());

  let selectedVersion: string;
  let resolvedChannel: PublishChannel | undefined;

  if (input.selector.strategy === "version") {
    selectedVersion = input.selector.version;
  } else if (input.selector.strategy === "channel") {
    const resolved = await resolveVersionFn(
      input.registryBaseUrl,
      input.ownerSlug,
      input.skillSlug,
      input.selector.channel,
      { timeoutMs: input.requestTimeoutMs },
    );
    selectedVersion = resolved.version;
    resolvedChannel = resolved.channel;
  } else {
    try {
      const resolved = await resolveVersionFn(
        input.registryBaseUrl,
        input.ownerSlug,
        input.skillSlug,
        "latest",
        { timeoutMs: input.requestTimeoutMs },
      );
      selectedVersion = resolved.version;
      resolvedChannel = resolved.channel;
    } catch (error) {
      if (!shouldFallbackToBeta(error)) {
        throw error;
      }

      const resolved = await resolveVersionFn(
        input.registryBaseUrl,
        input.ownerSlug,
        input.skillSlug,
        "beta",
        { timeoutMs: input.requestTimeoutMs },
      );
      selectedVersion = resolved.version;
      resolvedChannel = resolved.channel;
    }
  }

  const descriptor = await getArtifactDescriptorFn(
    input.registryBaseUrl,
    {
      ownerSlug: input.ownerSlug,
      skillSlug: input.skillSlug,
      version: selectedVersion,
    },
    { timeoutMs: input.requestTimeoutMs },
  );

  if (descriptor.yanked && !input.allowYanked) {
    throw new Error(
      `selected version is yanked. Re-run with --allow-yanked to proceed` +
        `${descriptor.yankedReason ? ` (${descriptor.yankedReason})` : ""}.`,
    );
  }

  const download = await downloadArtifactFn(descriptor.downloadUrl, {
    timeoutMs: input.requestTimeoutMs,
  });

  verifyDownloadedArtifact(descriptor, download.bytes, download.contentType);

  const canonicalSkillId = `@${descriptor.ownerLogin}/${descriptor.skill}`;
  const installedPath = resolveInstalledSkillPath(
    input.cwd,
    input.registryBaseUrl,
    descriptor.ownerLogin,
    descriptor.skill,
  );
  const installedAt = now().toISOString();
  const sourceCommand = input.sourceCommandFactory({
    canonicalSkillId,
    selector: input.selector,
    resolvedChannel,
  });

  const metadata: InstalledSkillMetadata = {
    skillId: canonicalSkillId,
    ownerLogin: descriptor.ownerLogin,
    skill: descriptor.skill,
    version: descriptor.version,
    digest: descriptor.digest,
    sizeBytes: descriptor.sizeBytes,
    mediaType: descriptor.mediaType,
    registryBaseUrl: input.registryBaseUrl,
    downloadedFrom: sanitizeDownloadedFrom(download.downloadedFrom),
    installedAt,
    sourceCommand,
    installIntent: toInstallIntent(input.selector),
  };

  await installArtifactFn({
    targetPath: installedPath,
    tempRoot: resolveInstallTempRoot(input.cwd),
    archiveBytes: download.bytes,
    metadata,
  });

  return {
    result: {
      skillId: canonicalSkillId,
      ownerLogin: descriptor.ownerLogin,
      skill: descriptor.skill,
      version: descriptor.version,
      digest: descriptor.digest,
      sizeBytes: descriptor.sizeBytes,
      mediaType: descriptor.mediaType,
      installedPath,
      registryBaseUrl: input.registryBaseUrl,
      installedAt,
      source: "registry",
    },
    metadata,
    resolvedChannel,
  };
}
