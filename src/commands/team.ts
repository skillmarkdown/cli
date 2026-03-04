import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { failWithUsage } from "../lib/shared/command-output";
import { TEAM_USAGE } from "../lib/shared/cli-text";
import { getLoginScopedRegistryEnvConfig } from "../lib/shared/env-config";
import { printJson } from "../lib/shared/json-output";
import {
  addTeamMember as defaultAddTeamMember,
  createTeam as defaultCreateTeam,
  getTeam as defaultGetTeam,
  listTeamMembers as defaultListTeamMembers,
  removeTeamMember as defaultRemoveTeamMember,
  updateTeamMemberRole as defaultUpdateTeamMemberRole,
} from "../lib/team/client";
import { isTeamApiError } from "../lib/team/errors";
import { parseTeamFlags } from "../lib/team/flags";
import {
  type TeamEnvConfig,
  type TeamMemberMutationResponse,
  type TeamMembersResponse,
  type TeamRecord,
  type TeamRole,
} from "../lib/team/types";

interface TeamCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => TeamEnvConfig;
  resolveReadIdToken?: () => Promise<string | null>;
  createTeam?: (
    baseUrl: string,
    idToken: string,
    request: { team: string; displayName: string },
    options?: { timeoutMs?: number },
  ) => Promise<TeamRecord>;
  getTeam?: (
    baseUrl: string,
    idToken: string,
    teamSlug: string,
    options?: { timeoutMs?: number },
  ) => Promise<TeamRecord>;
  listTeamMembers?: (
    baseUrl: string,
    idToken: string,
    teamSlug: string,
    options?: { timeoutMs?: number },
  ) => Promise<TeamMembersResponse>;
  addTeamMember?: (
    baseUrl: string,
    idToken: string,
    teamSlug: string,
    request: { ownerLogin: string; role: Exclude<TeamRole, "owner"> },
    options?: { timeoutMs?: number },
  ) => Promise<TeamMemberMutationResponse>;
  updateTeamMemberRole?: (
    baseUrl: string,
    idToken: string,
    teamSlug: string,
    ownerLogin: string,
    request: { role: Exclude<TeamRole, "owner"> },
    options?: { timeoutMs?: number },
  ) => Promise<TeamMemberMutationResponse>;
  removeTeamMember?: (
    baseUrl: string,
    idToken: string,
    teamSlug: string,
    ownerLogin: string,
    options?: { timeoutMs?: number },
  ) => Promise<TeamMemberMutationResponse>;
}

function titleizeTeamSlug(team: string): string {
  return team
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function printTeamRecord(team: TeamRecord): void {
  console.log(`Team: ${team.team}`);
  console.log(`Display name: ${team.displayName}`);
  console.log(`Role: ${team.role}`);
  console.log(`Created: ${team.createdAt}`);
  if (team.updatedAt) {
    console.log(`Updated: ${team.updatedAt}`);
  }
}

function printTeamMembers(result: TeamMembersResponse): void {
  console.log(`Team: ${result.team}`);
  console.log(`Members: ${result.members.length}`);
  for (const member of result.members) {
    console.log(`${member.owner} (${member.role}) added=${member.addedAt}`);
  }
}

function printMutation(result: TeamMemberMutationResponse): void {
  if (result.status === "added") {
    console.log(`Added ${result.owner} to ${result.team} as ${result.role}.`);
    return;
  }
  if (result.status === "updated") {
    console.log(`Updated ${result.owner} role to ${result.role} in ${result.team}.`);
    return;
  }
  console.log(`Removed ${result.owner} from ${result.team}.`);
}

function toAclHint(reason: string | undefined): string | null {
  if (reason === "forbidden_scope") {
    return "Hint: use a token with required scope (for example: skillmd token add ci --scope admin).";
  }
  if (reason === "forbidden_owner" || reason === "forbidden_role") {
    return "Hint: verify your memberships and role with 'skillmd whoami'.";
  }
  if (reason === "forbidden_plan") {
    return "Hint: this action is blocked by plan entitlements.";
  }
  return null;
}

function isTeamsDisabledError(error: { status: number; code: string }): boolean {
  return error.status === 404 && error.code === "not_found";
}

export async function runTeamCommand(
  args: string[],
  options: TeamCommandOptions = {},
): Promise<number> {
  const parsed = parseTeamFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd team: unsupported argument(s)", TEAM_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getLoginScopedRegistryEnvConfig)(env);
    const idToken = await (
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }))
    )();
    if (!idToken) {
      console.error("skillmd team: not logged in. Run 'skillmd login' first.");
      return 1;
    }

    if (parsed.action === "create") {
      const result = await (options.createTeam ?? defaultCreateTeam)(
        config.registryBaseUrl,
        idToken,
        {
          team: parsed.team,
          displayName: parsed.displayName ?? titleizeTeamSlug(parsed.team),
        },
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printTeamRecord(result);
      }
      return 0;
    }

    if (parsed.action === "view") {
      const result = await (options.getTeam ?? defaultGetTeam)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printTeamRecord(result);
      }
      return 0;
    }

    if (parsed.action === "members_ls") {
      const result = await (options.listTeamMembers ?? defaultListTeamMembers)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printTeamMembers(result);
      }
      return 0;
    }

    if (parsed.action === "members_add") {
      const result = await (options.addTeamMember ?? defaultAddTeamMember)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        {
          ownerLogin: parsed.ownerLogin,
          role: parsed.role,
        },
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printMutation(result);
      }
      return 0;
    }

    if (parsed.action === "members_set_role") {
      const result = await (options.updateTeamMemberRole ?? defaultUpdateTeamMemberRole)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        parsed.ownerLogin,
        { role: parsed.role },
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printMutation(result);
      }
      return 0;
    }

    const result = await (options.removeTeamMember ?? defaultRemoveTeamMember)(
      config.registryBaseUrl,
      idToken,
      parsed.team,
      parsed.ownerLogin,
      { timeoutMs: config.requestTimeoutMs },
    );
    if (parsed.json) {
      printJson(result as unknown as Record<string, unknown>);
    } else {
      printMutation(result);
    }
    return 0;
  } catch (error) {
    if (isTeamApiError(error)) {
      if (!parsed.json && isTeamsDisabledError(error)) {
        console.error(
          "skillmd team: teams API is unavailable on this environment (service returned not_found).",
        );
        return 1;
      }

      console.error(`skillmd team: ${error.message} (${error.code}, status ${error.status})`);
      const details =
        error.details && typeof error.details === "object"
          ? (error.details as Record<string, unknown>)
          : null;
      const reason = typeof details?.reason === "string" ? details.reason : undefined;
      if (reason) {
        console.error(`skillmd team: reason=${reason}`);
      }
      const hint = toAclHint(reason);
      if (!parsed.json && hint) {
        console.error(hint);
      }
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd team: ${message}`);
    return 1;
  }
}
