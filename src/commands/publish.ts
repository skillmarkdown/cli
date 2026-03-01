import { basename, resolve } from "node:path";

import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { getPublishEnvConfig } from "../lib/publish/config";
import { isPublishApiError } from "../lib/publish/errors";
import { parsePublishFlags, isPrereleaseVersion } from "../lib/publish/flags";
import { buildPublishManifest } from "../lib/publish/manifest";
import { packSkillArtifact } from "../lib/publish/pack";
import { commitPublish, preparePublish, uploadArtifact } from "../lib/publish/client";
import {
  type CommitPublishResponse,
  MAX_PUBLISH_ARTIFACT_SIZE_BYTES,
  type PackedArtifact,
  type PreparePublishResponse,
  type PublishChannel,
  type PublishEnvConfig,
  type PublishManifest,
} from "../lib/publish/types";
import { PUBLISH_USAGE } from "../lib/shared/cli-text";
import { failWithUsage, printValidationResult } from "../lib/shared/command-output";
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
    channel: PublishChannel;
    artifact: PackedArtifact;
  }) => PublishManifest;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  preparePublish?: (
    baseUrl: string,
    idToken: string,
    payload: {
      skill: string;
      version: string;
      channel: PublishChannel;
      digest: string;
      sizeBytes: number;
      mediaType: string;
      manifest: PublishManifest;
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

const GITHUB_USERNAME_PATTERN = /^[a-z0-9]+(?:-?[a-z0-9]+)*$/i;

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

function deriveOwnerFromSession(session: AuthSession): string | null {
  if (!session.githubUsername) {
    return null;
  }

  const cleaned = session.githubUsername.trim().replace(/^@+/, "");
  if (!cleaned || !GITHUB_USERNAME_PATTERN.test(cleaned)) {
    return null;
  }

  return `@${cleaned.toLowerCase()}`;
}

function printDryRunResult(
  json: boolean,
  payload: {
    skillId: string;
    version: string;
    channel: PublishChannel;
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
      `(channel: ${payload.channel}, digest: ${payload.digest}, size: ${payload.sizeBytes} bytes).`,
  );
}

function printPublishedResult(
  json: boolean,
  status: "published" | "idempotent",
  payload: { skillId: string; version: string; channel: PublishChannel; digest: string },
): void {
  if (json) {
    printJson({ status, ...payload });
    return;
  }

  if (status === "idempotent") {
    console.log(
      `Already published ${payload.skillId}@${payload.version} ` +
        `(channel: ${payload.channel}, digest: ${payload.digest}).`,
    );
    return;
  }

  console.log(
    `Published ${payload.skillId}@${payload.version} ` +
      `(channel: ${payload.channel}, digest: ${payload.digest}).`,
  );
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
  const channel = parsed.channel ?? (isPrereleaseVersion(parsed.version) ? "beta" : "latest");

  const validateSkillFn = options.validateSkill ?? validateSkill;
  const validation = validateSkillFn(targetDir, { strict: true });
  if (validation.status !== "passed") {
    printValidationResult(validation);
    console.error("Run 'skillmd validate --strict' after fixing issues.");
    return 1;
  }

  const readSessionFn = options.readSession ?? readAuthSession;
  const session = readSessionFn();
  if (!session) {
    console.error("skillmd publish: not logged in. Run 'skillmd login' first.");
    return 1;
  }
  const owner = deriveOwnerFromSession(session);
  if (!owner) {
    console.error(
      "skillmd publish: missing GitHub username in session. Run 'skillmd login --reauth' first.",
    );
    return 1;
  }

  try {
    const getConfigFn = options.getConfig ?? getPublishEnvConfig;
    const config = getConfigFn(env);

    if (session.projectId && session.projectId !== config.firebaseProjectId) {
      console.error(
        `skillmd publish: session project '${session.projectId}' does not match current config ` +
          `'${config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
      );
      return 1;
    }

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
    const skillId = `${owner}/${skill}`;

    const buildManifestFn = options.buildManifest ?? buildPublishManifest;
    const manifest = buildManifestFn({
      targetDir,
      skill,
      version: parsed.version,
      channel,
      artifact,
    });

    if (parsed.dryRun) {
      printDryRunResult(parsed.json, {
        skillId,
        version: parsed.version,
        channel,
        digest: artifact.digest,
        sizeBytes: artifact.sizeBytes,
        registryBaseUrl: config.registryBaseUrl,
      });
      return 0;
    }

    const exchangeRefreshTokenFn = options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken;
    const idTokenSession = await exchangeRefreshTokenFn(
      config.firebaseApiKey,
      session.refreshToken,
    );

    const preparePublishFn = options.preparePublish ?? preparePublish;
    const prepared = await preparePublishFn(
      config.registryBaseUrl,
      idTokenSession.idToken,
      {
        skill,
        version: parsed.version,
        channel,
        digest: artifact.digest,
        sizeBytes: artifact.sizeBytes,
        mediaType: artifact.mediaType,
        manifest,
      },
      { timeoutMs: config.requestTimeoutMs },
    );

    if (prepared.status === "idempotent") {
      printPublishedResult(parsed.json, "idempotent", {
        skillId: prepared.skillId,
        version: prepared.version,
        digest: prepared.digest,
        channel: prepared.channel,
      });
      return 0;
    }

    const uploadArtifactFn = options.uploadArtifact ?? uploadArtifact;
    await uploadArtifactFn(
      prepared.uploadUrl,
      artifact.tarGz,
      artifact.mediaType,
      prepared.uploadMethod,
      prepared.uploadHeaders,
      { timeoutMs: config.requestTimeoutMs },
    );

    const commitPublishFn = options.commitPublish ?? commitPublish;
    const committed = await commitPublishFn(
      config.registryBaseUrl,
      idTokenSession.idToken,
      { publishToken: prepared.publishToken },
      { timeoutMs: config.requestTimeoutMs },
    );

    printPublishedResult(parsed.json, "published", {
      skillId: committed.skillId,
      version: committed.version,
      digest: committed.digest,
      channel: committed.channel,
    });
    return 0;
  } catch (error) {
    if (isPublishApiError(error)) {
      if (error.status === 409 && error.code === "version_conflict") {
        console.error(
          `skillmd publish: version conflict for ${owner}/${basename(targetDir)}@${parsed.version}. ` +
            "Use a new version number.",
        );
        return 1;
      }

      console.error(`skillmd publish: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd publish: ${message}`);
    return 1;
  }
}
