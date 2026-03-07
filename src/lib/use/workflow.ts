import { callWithReadTokenRetry } from "../auth/read-token-retry";
import { resolveInstalledSkillPath, resolveInstallTempRoot } from "./pathing";
import { DEFAULT_AGENT_TARGET, type AgentTarget } from "../shared/agent-target";
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
  type InstalledSkillLockEntry,
  type InstallSelector,
  type InstallWorkflowResult,
  type ResolveSkillVersionResponse,
} from "./types";

export interface InstallWorkflowInput {
  registryBaseUrl: string;
  requestTimeoutMs: number;
  idToken?: string;
  resolveReadIdToken?: () => Promise<string | null>;
  cwd: string;
  username: string;
  skillSlug: string;
  selector: InstallSelector;
  selectedAgentTarget?: AgentTarget;
  defaultAgentTarget?: AgentTarget;
  sourceCommandFactory: (input: {
    canonicalSkillId: string;
    selector: InstallSelector;
    resolvedAgentTarget: AgentTarget;
  }) => string;
  now?: () => Date;
}

export interface UseWorkflowDependencies {
  resolveVersion?: (
    baseUrl: string,
    username: string,
    skillSlug: string,
    spec: string,
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<ResolveSkillVersionResponse>;
  getArtifactDescriptor?: (
    baseUrl: string,
    request: { username: string; skillSlug: string; version: string },
    options?: { timeoutMs?: number; idToken?: string },
  ) => Promise<ArtifactDescriptorResponse>;
  downloadArtifact?: (
    downloadUrl: string,
    options?: { timeoutMs?: number },
  ) => Promise<{ bytes: Buffer; downloadedFrom: string; contentType?: string }>;
  installArtifact?: (input: {
    targetPath: string;
    tempRoot: string;
    archiveBytes: Buffer;
  }) => Promise<void>;
}

function shouldRetryWithReadToken(error: unknown): boolean {
  if (!isUseApiError(error)) {
    return false;
  }

  if (error.status === 401 || error.status === 403) {
    return true;
  }

  if (error.status === 404 && (error.code === "not_found" || error.code === "invalid_request")) {
    return /not found/i.test(error.message);
  }

  return false;
}

function sanitizeDownloadedFrom(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "redacted";
  }
}

function selectorToSpec(selector: InstallSelector): string {
  if (selector.strategy === "version") {
    return selector.version;
  }

  return selector.spec;
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
  let idToken = input.idToken;

  async function callWithOptionalReadTokenRetry<T>(
    request: (token?: string) => Promise<T>,
  ): Promise<T> {
    const response = await callWithReadTokenRetry({
      request,
      resolveReadIdToken: input.resolveReadIdToken,
      shouldRetry: shouldRetryWithReadToken,
      idToken,
    });
    idToken = response.idToken;
    return response.result;
  }

  let selectedVersion: string;

  if (input.selector.strategy === "version") {
    selectedVersion = input.selector.version;
  } else {
    const selectorSpec = input.selector.spec;
    const resolved = await callWithOptionalReadTokenRetry((token) =>
      resolveVersionFn(input.registryBaseUrl, input.username, input.skillSlug, selectorSpec, {
        timeoutMs: input.requestTimeoutMs,
        idToken: token,
      }),
    );
    selectedVersion = resolved.version;
  }

  const descriptor = await callWithOptionalReadTokenRetry((token) =>
    getArtifactDescriptorFn(
      input.registryBaseUrl,
      {
        username: input.username,
        skillSlug: input.skillSlug,
        version: selectedVersion,
      },
      { timeoutMs: input.requestTimeoutMs, idToken: token },
    ),
  );
  const warnings: string[] = [];
  if (descriptor.deprecated) {
    const message = descriptor.deprecatedMessage
      ? `Deprecated version ${descriptor.version}: ${descriptor.deprecatedMessage}.`
      : `Deprecated version ${descriptor.version}.`;
    warnings.push(message);
  }

  const download = await downloadArtifactFn(descriptor.downloadUrl, {
    timeoutMs: input.requestTimeoutMs,
  });

  verifyDownloadedArtifact(descriptor, download.bytes, download.contentType);

  const canonicalSkillId = `@${descriptor.username}/${descriptor.skill}`;
  const resolvedAgentTarget =
    input.selectedAgentTarget ??
    descriptor.agentTarget ??
    input.defaultAgentTarget ??
    DEFAULT_AGENT_TARGET;
  const installedPath = resolveInstalledSkillPath(
    input.cwd,
    input.registryBaseUrl,
    descriptor.username,
    descriptor.skill,
    resolvedAgentTarget,
  );
  const installedAt = now().toISOString();
  const sourceCommand = input.sourceCommandFactory({
    canonicalSkillId,
    selector: input.selector,
    resolvedAgentTarget,
  });
  const selectorSpec = selectorToSpec(input.selector);
  const lockEntry: InstalledSkillLockEntry = {
    skillId: canonicalSkillId,
    username: descriptor.username,
    skill: descriptor.skill,
    selectorSpec,
    version: descriptor.version,
    digest: descriptor.digest,
    sizeBytes: descriptor.sizeBytes,
    mediaType: descriptor.mediaType,
    installedPath,
    registryBaseUrl: input.registryBaseUrl,
    downloadedFrom: sanitizeDownloadedFrom(download.downloadedFrom),
    installedAt,
    sourceCommand,
    agentTarget: resolvedAgentTarget,
  };

  await installArtifactFn({
    targetPath: installedPath,
    tempRoot: resolveInstallTempRoot(input.cwd, resolvedAgentTarget),
    archiveBytes: download.bytes,
  });

  return {
    result: {
      skillId: canonicalSkillId,
      username: descriptor.username,
      skill: descriptor.skill,
      version: descriptor.version,
      digest: descriptor.digest,
      sizeBytes: descriptor.sizeBytes,
      mediaType: descriptor.mediaType,
      installedPath,
      registryBaseUrl: input.registryBaseUrl,
      installedAt,
      source: "registry",
      agentTarget: resolvedAgentTarget,
    },
    lockEntry,
    warnings,
  };
}
