import { basename, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { deriveOwnerFromSession } from "../lib/auth/owner";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { getPublishEnvConfig } from "../lib/publish/config";
import { isPublishApiError } from "../lib/publish/errors";
import { parsePublishFlags } from "../lib/publish/flags";
import { buildPublishManifest } from "../lib/publish/manifest";
import { packSkillArtifact } from "../lib/publish/pack";
import { commitPublish, preparePublish, uploadArtifact } from "../lib/publish/client";
import {
  type CommitPublishResponse,
  MAX_PUBLISH_ARTIFACT_SIZE_BYTES,
  MAX_PUBLISH_MANIFEST_SIZE_BYTES,
  MAX_PUBLISH_README_SIZE_BYTES,
  type PackedArtifact,
  type PreparePublishResponse,
  type PublishAccess,
  type PublishEnvConfig,
  type PublishManifest,
} from "../lib/publish/types";
import { PUBLISH_USAGE } from "../lib/shared/cli-text";
import { DEFAULT_AGENT_TARGET } from "../lib/shared/agent-target";
import { failWithUsage, printValidationResult } from "../lib/shared/command-output";
import { printJson } from "../lib/shared/json-output";
import { formatCliApiErrorWithHint } from "../lib/shared/authz-error-hints";
import { type ValidationResult, validateSkill } from "../lib/validation/validator";

interface PublishCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  readSession?: () => AuthSession | null;
  validateSkill?: (targetDir: string, options?: { strict?: boolean }) => ValidationResult;
  getConfig?: (env: NodeJS.ProcessEnv) => PublishEnvConfig;
  packArtifact?: (targetDir: string) => PackedArtifact;
  buildManifest?: (options: {
    targetDir: string;
    skill: string;
    version: string;
    tag: string;
    access: PublishAccess;
    provenance: boolean;
    artifact: PackedArtifact;
  }) => PublishManifest;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  preparePublish?: (
    baseUrl: string,
    idToken: string,
    payload: {
      skill: string;
      version: string;
      tag: string;
      access: PublishAccess;
      provenance: boolean;
      packageMeta: {
        name: string;
        version: string;
        description: string;
        repository?: string;
        homepage?: string;
        license?: string;
        unpackedSizeBytes?: number;
        totalFiles?: number;
      };
      agentTarget?: string;
      digest: string;
      sizeBytes: number;
      mediaType: string;
      manifest: PublishManifest;
      readme?: string;
    },
    options?: { timeoutMs?: number },
  ) => Promise<PreparePublishResponse>;
  uploadArtifact?: (
    uploadUrl: string,
    tarGz: Buffer,
    mediaType: string,
    uploadMethod?: "PUT" | "POST",
    uploadHeaders?: Record<string, string>,
    options?: { timeoutMs?: number },
  ) => Promise<void>;
  commitPublish?: (
    baseUrl: string,
    idToken: string,
    payload: { publishToken: string },
    options?: { timeoutMs?: number },
  ) => Promise<CommitPublishResponse>;
}

function printDryRunResult(
  json: boolean,
  payload: {
    skillId: string;
    version: string;
    tag: string;
    access: PublishAccess;
    provenance: boolean;
    agentTarget: string;
    digest: string;
    sizeBytes: number;
    registryBaseUrl: string;
  },
): void {
  if (json) {
    printJson({
      status: "dry-run",
      ...payload,
    });
    return;
  }

  console.log(
    `Publish dry-run ready: ${payload.skillId}@${payload.version} ` +
      `(tag: ${payload.tag}, access: ${payload.access}, provenance: ${payload.provenance}, ` +
      `target: ${payload.agentTarget}, digest: ${payload.digest}, size: ${payload.sizeBytes} bytes).`,
  );
}

function printPublishedResult(
  json: boolean,
  status: "published" | "idempotent",
  payload: {
    skillId: string;
    version: string;
    tag: string;
    agentTarget: string;
    distTags?: Record<string, string>;
    provenance?: {
      requested: boolean;
      recorded: boolean;
    };
  },
): void {
  if (json) {
    printJson({ status, ...payload });
    return;
  }

  if (status === "idempotent") {
    console.log(
      `Already published ${payload.skillId}@${payload.version} ` +
        `(tag: ${payload.tag}, target: ${payload.agentTarget}).`,
    );
    return;
  }

  console.log(
    `Published ${payload.skillId}@${payload.version} ` +
      `(tag: ${payload.tag}, target: ${payload.agentTarget}).`,
  );
}

function measureManifestSizeBytes(manifest: PublishManifest): number {
  return Buffer.byteLength(JSON.stringify(manifest), "utf8");
}

function readOptionalRootReadme(targetDir: string): string | undefined {
  const readmePath = resolve(targetDir, "README.md");
  if (!existsSync(readmePath)) {
    return undefined;
  }
  const raw = readFileSync(readmePath, "utf8");
  const normalized = raw.replace(/\r\n?/g, "\n");
  const sizeBytes = Buffer.byteLength(normalized, "utf8");
  if (sizeBytes > MAX_PUBLISH_README_SIZE_BYTES) {
    throw new Error(
      `skillmd publish: README.md exceeds max size (${sizeBytes} bytes > ${MAX_PUBLISH_README_SIZE_BYTES} bytes).`,
    );
  }
  return normalized;
}

export async function runPublishCommand(
  args: string[],
  options: PublishCommandOptions = {},
): Promise<number> {
  const parsed = parsePublishFlags(args);
  if (!parsed.valid || !parsed.version) {
    return failWithUsage("skillmd publish: unsupported argument(s)", PUBLISH_USAGE);
  }

  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const targetDir = parsed.pathArg ? resolve(cwd, parsed.pathArg) : cwd;
  const tag = parsed.tag ?? "latest";
  const access = parsed.access ?? "public";
  const provenance = parsed.provenance;

  const validateSkillFn = options.validateSkill ?? validateSkill;
  const validation = validateSkillFn(targetDir, { strict: true });
  if (validation.status !== "passed") {
    printValidationResult(validation);
    console.error("Run 'skillmd validate --strict' after fixing issues.");
    return 1;
  }

  const readSessionFn = options.readSession ?? readAuthSession;
  const session = readSessionFn();
  let owner = session ? deriveOwnerFromSession(session) : null;

  try {
    const getConfigFn = options.getConfig ?? getPublishEnvConfig;
    const config = getConfigFn(env);
    const agentTarget = parsed.agentTarget ?? config.defaultAgentTarget ?? DEFAULT_AGENT_TARGET;

    const packArtifactFn = options.packArtifact ?? packSkillArtifact;
    const artifact = packArtifactFn(targetDir);

    if (artifact.sizeBytes > MAX_PUBLISH_ARTIFACT_SIZE_BYTES) {
      console.error(
        `skillmd publish: artifact exceeds max size (${artifact.sizeBytes} bytes > ` +
          `${MAX_PUBLISH_ARTIFACT_SIZE_BYTES} bytes).`,
      );
      return 1;
    }

    const skill = basename(targetDir);
    const skillId = `${owner ?? "@unknown"}/${skill}`;

    const buildManifestFn = options.buildManifest ?? buildPublishManifest;
    const manifest = buildManifestFn({
      targetDir,
      skill,
      version: parsed.version,
      tag,
      access,
      provenance,
      artifact,
    });
    const artifactFiles = Array.isArray(artifact.files) ? artifact.files : [];
    const packageMeta = {
      name: skill,
      version: parsed.version,
      description: manifest.description?.trim() || skill,
      repository: manifest.repository,
      homepage: manifest.homepage,
      license: manifest.license,
      unpackedSizeBytes: artifactFiles.reduce((total, entry) => total + entry.sizeBytes, 0),
      totalFiles: artifactFiles.length,
    };
    const manifestSizeBytes = measureManifestSizeBytes(manifest);
    if (manifestSizeBytes > MAX_PUBLISH_MANIFEST_SIZE_BYTES) {
      console.error(
        `skillmd publish: manifest exceeds max size (${manifestSizeBytes} bytes > ` +
          `${MAX_PUBLISH_MANIFEST_SIZE_BYTES} bytes).`,
      );
      return 1;
    }
    const readme = readOptionalRootReadme(targetDir);

    if (parsed.dryRun) {
      printDryRunResult(parsed.json, {
        skillId,
        version: parsed.version,
        tag,
        access,
        provenance,
        agentTarget,
        digest: artifact.digest,
        sizeBytes: artifact.sizeBytes,
        registryBaseUrl: config.registryBaseUrl,
      });
      return 0;
    }

    const auth = await resolveWriteAuth({
      command: "skillmd publish",
      env,
      config,
      readSession: options.readSession ?? readAuthSession,
      exchangeRefreshToken: options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken,
      requireOwner: true,
    });
    if (!auth.ok) {
      console.error(auth.message);
      return 1;
    }

    const preparePublishFn = options.preparePublish ?? preparePublish;
    const prepared = await preparePublishFn(
      config.registryBaseUrl,
      auth.value.idToken,
      {
        skill,
        version: parsed.version,
        tag,
        access,
        provenance,
        packageMeta,
        agentTarget,
        digest: artifact.digest,
        sizeBytes: artifact.sizeBytes,
        mediaType: artifact.mediaType,
        manifest,
        readme,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    if (prepared.status === "upload_required") {
      const uploadArtifactFn = options.uploadArtifact ?? uploadArtifact;
      await uploadArtifactFn(
        prepared.uploadUrl,
        artifact.tarGz,
        artifact.mediaType,
        prepared.uploadMethod,
        prepared.uploadHeaders,
        { timeoutMs: config.requestTimeoutMs },
      );
    }

    const commitPublishFn = options.commitPublish ?? commitPublish;
    const committed = await commitPublishFn(
      config.registryBaseUrl,
      auth.value.idToken,
      { publishToken: prepared.publishToken },
      { timeoutMs: config.requestTimeoutMs },
    );

    printPublishedResult(parsed.json, committed.status, {
      skillId: committed.skillId,
      version: committed.version,
      tag: committed.tag,
      agentTarget: committed.agentTarget ?? agentTarget,
      distTags: committed.distTags,
      provenance: committed.provenance,
    });
    return 0;
  } catch (error) {
    if (isPublishApiError(error)) {
      if (error.status === 409 && error.code === "version_conflict") {
        if (!owner && session) {
          owner = deriveOwnerFromSession(session);
        }
        console.error(
          `skillmd publish: version conflict for ${owner ?? "@unknown"}/${basename(targetDir)}@${parsed.version}. ` +
            "Use a new version number.",
        );
        return 1;
      }

      console.error(formatCliApiErrorWithHint("skillmd publish", error));
      return 1;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd publish: ${message}`);
    return 1;
  }
}
