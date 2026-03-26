import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { parseSkillId } from "../lib/registry/skill-id";
import { failWithUsage } from "../lib/shared/command-output";
import {
  getAuthRegistryEnvConfig,
  getLoginScopedRegistryEnvConfig,
} from "../lib/shared/env-config";
import { executeReadCommand, executeWriteCommand } from "../lib/shared/command-execution";
import { COLLABORATORS_USAGE } from "../lib/shared/cli-text";
import {
  addSkillCollaborator as defaultAddSkillCollaborator,
  listSkillCollaborators as defaultListSkillCollaborators,
  removeSkillCollaborator as defaultRemoveSkillCollaborator,
} from "../lib/collaborators/client";
import { isCollaboratorsApiError } from "../lib/collaborators/errors";
import { parseCollaboratorsFlags } from "../lib/collaborators/flags";
import {
  type AddSkillCollaboratorResponse,
  type CollaboratorsEnvConfig,
  type ListSkillCollaboratorsResponse,
  type RemoveSkillCollaboratorResponse,
} from "../lib/collaborators/types";

interface CollaboratorsCommandOptions {
  env?: NodeJS.ProcessEnv;
  getAuthConfig?: (env: NodeJS.ProcessEnv) => CollaboratorsEnvConfig;
  getReadConfig?: (env: NodeJS.ProcessEnv) => { registryBaseUrl: string; requestTimeoutMs: number };
  resolveReadIdToken?: () => Promise<string | null>;
  listSkillCollaborators?: (
    baseUrl: string,
    idToken: string,
    skillSlug: string,
    options?: { timeoutMs?: number },
  ) => Promise<ListSkillCollaboratorsResponse>;
  addSkillCollaborator?: (
    baseUrl: string,
    idToken: string,
    skillSlug: string,
    request: { username: string; role: "maintainer" },
    options?: { timeoutMs?: number },
  ) => Promise<AddSkillCollaboratorResponse>;
  removeSkillCollaborator?: (
    baseUrl: string,
    idToken: string,
    skillSlug: string,
    username: string,
    options?: { timeoutMs?: number },
  ) => Promise<RemoveSkillCollaboratorResponse>;
}

function requirePersonalSkillId(skillId: string): { skillId: string; skillSlug: string } {
  const parsed = parseSkillId(skillId);
  if (parsed.username) {
    throw new Error("collaborator management currently supports bare personal skill ids only");
  }
  return { skillId: parsed.skillId, skillSlug: parsed.skillSlug };
}

function printCollaboratorsHuman(payload: ListSkillCollaboratorsResponse): void {
  console.log(`Skill: ${payload.owner}/${payload.skill}`);
  if (payload.collaborators.length === 0) {
    console.log("Collaborators: none");
    return;
  }
  console.log("Collaborators:");
  for (const collaborator of payload.collaborators) {
    const lastPublishedAt = collaborator.lastPublishedAt
      ? ` lastPublished=${collaborator.lastPublishedAt}`
      : "";
    console.log(
      `- @${collaborator.username} role=${collaborator.role} added=${collaborator.addedAt}${lastPublishedAt}`,
    );
  }
}

export async function runCollaboratorsCommand(
  args: string[],
  options: CollaboratorsCommandOptions = {},
): Promise<number> {
  const parsed = parseCollaboratorsFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd collaborators: unsupported argument(s)", COLLABORATORS_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const { skillId, skillSlug } = requirePersonalSkillId(parsed.skillId);

    if (parsed.action === "ls") {
      const config = (options.getReadConfig ?? getLoginScopedRegistryEnvConfig)(env);
      return executeReadCommand<ListSkillCollaboratorsResponse>({
        command: "skillmd collaborators",
        json: parsed.json,
        resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
        run: (idToken) =>
          (options.listSkillCollaborators ?? defaultListSkillCollaborators)(
            config.registryBaseUrl,
            idToken,
            skillSlug,
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: printCollaboratorsHuman,
        isApiError: isCollaboratorsApiError,
      });
    }

    const config = (options.getAuthConfig ?? getAuthRegistryEnvConfig)(env);
    const resolveCollaboratorsWriteAuth = async () => {
      const auth = await resolveWriteAuth({
        command: "skillmd collaborators",
        env,
        config,
      });
      return auth.ok
        ? { ok: true as const, idToken: auth.value.idToken }
        : { ok: false as const, message: auth.message };
    };

    if (parsed.action === "add") {
      return executeWriteCommand<AddSkillCollaboratorResponse>({
        command: "skillmd collaborators",
        json: parsed.json,
        resolveAuth: resolveCollaboratorsWriteAuth,
        run: (idToken) =>
          (options.addSkillCollaborator ?? defaultAddSkillCollaborator)(
            config.registryBaseUrl,
            idToken,
            skillSlug,
            { username: parsed.username, role: "maintainer" },
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Added @${result.collaborator.username} to ${skillId} as maintainer.`);
        },
        isApiError: isCollaboratorsApiError,
      });
    }

    return executeWriteCommand<RemoveSkillCollaboratorResponse>({
      command: "skillmd collaborators",
      json: parsed.json,
      resolveAuth: resolveCollaboratorsWriteAuth,
      run: (idToken) =>
        (options.removeSkillCollaborator ?? defaultRemoveSkillCollaborator)(
          config.registryBaseUrl,
          idToken,
          skillSlug,
          parsed.username,
          { timeoutMs: config.requestTimeoutMs },
        ),
      printHuman: (result) => {
        console.log(`Removed @${result.collaborator.username} from ${skillId}.`);
      },
      isApiError: isCollaboratorsApiError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd collaborators: ${message}`);
    return 1;
  }
}
