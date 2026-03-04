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
  type MutableTeamRole,
  type TeamEnvConfig,
  type TeamMemberMutationResponse,
  type TeamMembersResponse,
  type TeamRecord,
} from "../lib/team/types";

interface TeamCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => TeamEnvConfig;
  resolveReadIdToken?: () => Promise<string | null>;
  createTeam?: typeof defaultCreateTeam;
  getTeam?: typeof defaultGetTeam;
  listTeamMembers?: typeof defaultListTeamMembers;
  addTeamMember?: typeof defaultAddTeamMember;
  updateTeamMemberRole?: typeof defaultUpdateTeamMemberRole;
  removeTeamMember?: typeof defaultRemoveTeamMember;
}

function titleizeTeamSlug(team: string): string {
  return team
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function printTeamRecord(team: TeamRecord): void {
  console.log(`Team: ${team.team}`);
  console.log(`Display name: ${team.displayName}`);
  console.log(`Role: ${team.role}`);
  console.log(`Created: ${team.createdAt}`);
  if (team.updatedAt) console.log(`Updated: ${team.updatedAt}`);
}

function printTeamMembers(result: TeamMembersResponse): void {
  console.log(`Team: ${result.team}`);
  console.log(`Members: ${result.members.length}`);
  for (const member of result.members)
    console.log(`${member.owner} (${member.role}) added=${member.addedAt}`);
}

function printMutation(result: TeamMemberMutationResponse): void {
  if (result.status === "added")
    console.log(`Added ${result.owner} to ${result.team} as ${result.role}.`);
  else if (result.status === "updated")
    console.log(`Updated ${result.owner} role to ${result.role} in ${result.team}.`);
  else console.log(`Removed ${result.owner} from ${result.team}.`);
}

function hintForReason(reason?: string): string | null {
  if (reason === "forbidden_scope")
    return "Hint: use a token with required scope (for example: skillmd token add ci --scope admin).";
  if (reason === "forbidden_owner" || reason === "forbidden_role")
    return "Hint: verify your memberships and role with 'skillmd whoami'.";
  if (reason === "forbidden_plan") return "Hint: this action is blocked by plan entitlements.";
  return null;
}

function printOutput(json: boolean, payload: Record<string, unknown>, human: () => void): void {
  if (json) printJson(payload);
  else human();
}

export async function runTeamCommand(
  args: string[],
  options: TeamCommandOptions = {},
): Promise<number> {
  const parsed = parseTeamFlags(args);
  if (!parsed.valid || !parsed.action)
    return failWithUsage("skillmd team: unsupported argument(s)", TEAM_USAGE);

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getLoginScopedRegistryEnvConfig)(env);
    const idToken = await (
      options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }))
    )();
    if (!idToken)
      return (console.error("skillmd team: not logged in. Run 'skillmd login' first."), 1);

    if (parsed.action === "create" && parsed.team) {
      const result = await (options.createTeam ?? defaultCreateTeam)(
        config.registryBaseUrl,
        idToken,
        { team: parsed.team, displayName: parsed.displayName ?? titleizeTeamSlug(parsed.team) },
        { timeoutMs: config.requestTimeoutMs },
      );
      printOutput(parsed.json, result as unknown as Record<string, unknown>, () =>
        printTeamRecord(result),
      );
      return 0;
    }

    if (parsed.action === "view" && parsed.team) {
      const result = await (options.getTeam ?? defaultGetTeam)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        {
          timeoutMs: config.requestTimeoutMs,
        },
      );
      printOutput(parsed.json, result as unknown as Record<string, unknown>, () =>
        printTeamRecord(result),
      );
      return 0;
    }

    if (parsed.action === "members_ls" && parsed.team) {
      const result = await (options.listTeamMembers ?? defaultListTeamMembers)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        { timeoutMs: config.requestTimeoutMs },
      );
      printOutput(parsed.json, result as unknown as Record<string, unknown>, () =>
        printTeamMembers(result),
      );
      return 0;
    }

    if (parsed.action === "members_add" && parsed.team && parsed.ownerLogin && parsed.role) {
      const result = await (options.addTeamMember ?? defaultAddTeamMember)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        { ownerLogin: parsed.ownerLogin, role: parsed.role as MutableTeamRole },
        { timeoutMs: config.requestTimeoutMs },
      );
      printOutput(parsed.json, result as unknown as Record<string, unknown>, () =>
        printMutation(result),
      );
      return 0;
    }

    if (parsed.action === "members_set_role" && parsed.team && parsed.ownerLogin && parsed.role) {
      const result = await (options.updateTeamMemberRole ?? defaultUpdateTeamMemberRole)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        parsed.ownerLogin,
        { role: parsed.role as MutableTeamRole },
        { timeoutMs: config.requestTimeoutMs },
      );
      printOutput(parsed.json, result as unknown as Record<string, unknown>, () =>
        printMutation(result),
      );
      return 0;
    }

    if (parsed.action === "members_rm" && parsed.team && parsed.ownerLogin) {
      const result = await (options.removeTeamMember ?? defaultRemoveTeamMember)(
        config.registryBaseUrl,
        idToken,
        parsed.team,
        parsed.ownerLogin,
        { timeoutMs: config.requestTimeoutMs },
      );
      printOutput(parsed.json, result as unknown as Record<string, unknown>, () =>
        printMutation(result),
      );
      return 0;
    }

    return failWithUsage("skillmd team: unsupported argument(s)", TEAM_USAGE);
  } catch (error) {
    if (isTeamApiError(error)) {
      if (!parsed.json && error.status === 404 && error.code === "not_found") {
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
      if (reason) console.error(`skillmd team: reason=${reason}`);
      const hint = hintForReason(reason);
      if (hint && !parsed.json) console.error(hint);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd team: ${message}`);
    return 1;
  }
}
