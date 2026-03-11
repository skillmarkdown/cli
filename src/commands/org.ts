import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { failWithUsage, printCommandResult } from "../lib/shared/command-output";
import {
  getAuthRegistryEnvConfig,
  getLoginScopedRegistryEnvConfig,
} from "../lib/shared/env-config";
import { formatCliApiErrorWithHint } from "../lib/shared/authz-error-hints";
import { ORG_USAGE } from "../lib/shared/cli-text";
import {
  addOrganizationMember as defaultAddOrganizationMember,
  addOrganizationTeamMember as defaultAddOrganizationTeamMember,
  assignOrganizationSkillTeam as defaultAssignOrganizationSkillTeam,
  createOrganizationTeam as defaultCreateOrganizationTeam,
  getOrganizationTeam as defaultGetOrganizationTeam,
  listOrganizationMembers as defaultListOrganizationMembers,
  listOrganizationSkills as defaultListOrganizationSkills,
  listOrganizationTeams as defaultListOrganizationTeams,
  removeOrganizationMember as defaultRemoveOrganizationMember,
  removeOrganizationTeamMember as defaultRemoveOrganizationTeamMember,
} from "../lib/org/client";
import { isOrgApiError } from "../lib/org/errors";
import {
  type OrgEnvConfig,
  type OrganizationMemberMutationResponse,
  type OrganizationMemberRemoveResponse,
  type OrganizationMembersResponse,
  type OrganizationMembership,
  type OrganizationRole,
  type OrganizationSkillTeamUpdateResponse,
  type OrganizationSkillsResponse,
  type OrganizationTeamCreateResponse,
  type OrganizationTeamMemberMutationResponse,
  type OrganizationTeamMemberRemoveResponse,
  type OrganizationTeamResponse,
  type OrganizationTeamsResponse,
} from "../lib/org/types";
import { parseOrgFlags } from "../lib/org/flags";
import { getWhoami as defaultGetWhoami } from "../lib/whoami/client";
import { type WhoamiResponse } from "../lib/whoami/types";

interface OrgCommandOptions {
  env?: NodeJS.ProcessEnv;
  getAuthConfig?: (env: NodeJS.ProcessEnv) => OrgEnvConfig;
  getReadConfig?: (env: NodeJS.ProcessEnv) => { registryBaseUrl: string; requestTimeoutMs: number };
  resolveReadIdToken?: () => Promise<string | null>;
  getWhoami?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<WhoamiResponse>;
  listOrganizationMembers?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationMembersResponse>;
  addOrganizationMember?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    request: { username: string; role: OrganizationRole },
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationMemberMutationResponse>;
  removeOrganizationMember?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    username: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationMemberRemoveResponse>;
  listOrganizationTeams?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTeamsResponse>;
  getOrganizationTeam?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    teamSlug: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTeamResponse>;
  createOrganizationTeam?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    request: { teamSlug: string; name: string },
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTeamCreateResponse>;
  addOrganizationTeamMember?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    teamSlug: string,
    request: { username: string },
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTeamMemberMutationResponse>;
  removeOrganizationTeamMember?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    teamSlug: string,
    username: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTeamMemberRemoveResponse>;
  listOrganizationSkills?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationSkillsResponse>;
  assignOrganizationSkillTeam?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    skillSlug: string,
    teamSlug: string | null,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationSkillTeamUpdateResponse>;
}

function printOrganizationListHuman(organizations: OrganizationMembership[]): void {
  if (organizations.length === 0) {
    console.log("No organization memberships found.");
    return;
  }

  for (const org of organizations) {
    console.log(`${org.owner} role=${org.role}`);
  }
}

function printOrganizationMembersHuman(payload: OrganizationMembersResponse): void {
  console.log(`Organization: ${payload.owner}`);
  console.log(`Viewer role: ${payload.viewerRole}`);
  if (payload.members.length === 0) {
    console.log("Members: none");
    return;
  }
  console.log("Members:");
  for (const member of payload.members) {
    console.log(`- ${member.owner} role=${member.role}`);
  }
}

function printOrganizationTeamsHuman(payload: OrganizationTeamsResponse): void {
  console.log(`Organization: ${payload.owner}`);
  console.log(`Viewer role: ${payload.viewerRole}`);
  if (payload.teams.length === 0) {
    console.log("Teams: none");
    return;
  }
  console.log("Teams:");
  for (const team of payload.teams) {
    const members = team.members.map((member) => member.owner).join(", ") || "none";
    console.log(`- ${team.teamSlug} name="${team.name}" members=${members}`);
  }
}

function printOrganizationTeamHuman(payload: OrganizationTeamResponse): void {
  console.log(`Organization: ${payload.owner}`);
  console.log(`Team: ${payload.team.teamSlug} (${payload.team.name})`);
  if (payload.team.members.length === 0) {
    console.log("Members: none");
    return;
  }
  console.log("Members:");
  for (const member of payload.team.members) {
    console.log(`- ${member.owner}`);
  }
}

function printOrganizationSkillsHuman(payload: OrganizationSkillsResponse): void {
  console.log(`Organization: ${payload.owner}`);
  console.log(`Viewer role: ${payload.viewerRole}`);
  if (payload.skills.length === 0) {
    console.log("Skills: none");
    return;
  }
  console.log("Skills:");
  for (const skill of payload.skills) {
    console.log(
      `- ${skill.skillId} visibility=${skill.visibility} latest=${skill.latestVersion ?? "-"} team=${skill.teamSlug ?? "-"}`,
    );
  }
}

export async function runOrgCommand(
  args: string[],
  options: OrgCommandOptions = {},
): Promise<number> {
  const parsed = parseOrgFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd org: unsupported argument(s)", ORG_USAGE);
  }

  const env = options.env ?? process.env;

  try {
    if (parsed.action === "ls") {
      const config = (options.getReadConfig ?? getLoginScopedRegistryEnvConfig)(env);
      const idToken = await (
        options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }))
      )();
      if (!idToken) {
        console.error("skillmd org: not logged in. Run 'skillmd login' first.");
        return 1;
      }

      const result = await (options.getWhoami ?? defaultGetWhoami)(
        config.registryBaseUrl,
        idToken,
        {
          timeoutMs: config.requestTimeoutMs,
        },
      );
      printCommandResult(parsed.json, { organizations: result.organizations ?? [] }, () =>
        printOrganizationListHuman(result.organizations ?? []),
      );
      return 0;
    }

    const readActions = new Set(["members.ls", "team.ls", "team.members.ls", "skills.ls"]);
    if (readActions.has(parsed.action)) {
      const config = (options.getReadConfig ?? getLoginScopedRegistryEnvConfig)(env);
      const idToken = await (
        options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env }))
      )();
      if (!idToken) {
        console.error("skillmd org: not logged in. Run 'skillmd login' first.");
        return 1;
      }

      if (parsed.action === "members.ls") {
        const result = await (options.listOrganizationMembers ?? defaultListOrganizationMembers)(
          config.registryBaseUrl,
          idToken,
          parsed.slug,
          { timeoutMs: config.requestTimeoutMs },
        );
        printCommandResult(parsed.json, result, () => printOrganizationMembersHuman(result));
        return 0;
      }

      if (parsed.action === "team.ls") {
        const result = await (options.listOrganizationTeams ?? defaultListOrganizationTeams)(
          config.registryBaseUrl,
          idToken,
          parsed.slug,
          { timeoutMs: config.requestTimeoutMs },
        );
        printCommandResult(parsed.json, result, () => printOrganizationTeamsHuman(result));
        return 0;
      }

      if (parsed.action === "team.members.ls") {
        const result = await (options.getOrganizationTeam ?? defaultGetOrganizationTeam)(
          config.registryBaseUrl,
          idToken,
          parsed.slug,
          parsed.teamSlug,
          { timeoutMs: config.requestTimeoutMs },
        );
        printCommandResult(parsed.json, result, () => printOrganizationTeamHuman(result));
        return 0;
      }

      const result = await (options.listOrganizationSkills ?? defaultListOrganizationSkills)(
        config.registryBaseUrl,
        idToken,
        parsed.slug,
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => printOrganizationSkillsHuman(result));
      return 0;
    }

    const config = (options.getAuthConfig ?? getAuthRegistryEnvConfig)(env);
    const auth = await resolveWriteAuth({
      command: "skillmd org",
      env,
      config,
    });
    if (!auth.ok) {
      console.error(auth.message);
      return 1;
    }

    if (parsed.action === "members.add") {
      const result = await (options.addOrganizationMember ?? defaultAddOrganizationMember)(
        config.registryBaseUrl,
        auth.value.idToken,
        parsed.slug,
        { username: parsed.username, role: parsed.role },
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => {
        console.log(`Added ${result.owner} to @${result.slug} as ${result.role}.`);
      });
      return 0;
    }

    if (parsed.action === "members.rm") {
      const result = await (options.removeOrganizationMember ?? defaultRemoveOrganizationMember)(
        config.registryBaseUrl,
        auth.value.idToken,
        parsed.slug,
        parsed.username,
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => {
        console.log(`Removed @${result.username} from @${result.slug}.`);
      });
      return 0;
    }

    if (parsed.action === "team.add") {
      const result = await (options.createOrganizationTeam ?? defaultCreateOrganizationTeam)(
        config.registryBaseUrl,
        auth.value.idToken,
        parsed.slug,
        { teamSlug: parsed.teamSlug, name: parsed.name },
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => {
        console.log(`Created team ${result.teamSlug} in @${result.slug}.`);
      });
      return 0;
    }

    if (parsed.action === "team.members.add") {
      const result = await (options.addOrganizationTeamMember ?? defaultAddOrganizationTeamMember)(
        config.registryBaseUrl,
        auth.value.idToken,
        parsed.slug,
        parsed.teamSlug,
        { username: parsed.username },
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => {
        console.log(`Added ${result.owner} to team ${result.teamSlug} in @${result.slug}.`);
      });
      return 0;
    }

    if (parsed.action === "team.members.rm") {
      const result = await (
        options.removeOrganizationTeamMember ?? defaultRemoveOrganizationTeamMember
      )(config.registryBaseUrl, auth.value.idToken, parsed.slug, parsed.teamSlug, parsed.username, {
        timeoutMs: config.requestTimeoutMs,
      });
      printCommandResult(parsed.json, result, () => {
        console.log(`Removed @${result.username} from team ${result.teamSlug} in @${result.slug}.`);
      });
      return 0;
    }

    if (parsed.action === "skills.team.set" || parsed.action === "skills.team.clear") {
      const result = await (
        options.assignOrganizationSkillTeam ?? defaultAssignOrganizationSkillTeam
      )(
        config.registryBaseUrl,
        auth.value.idToken,
        parsed.slug,
        parsed.skillSlug,
        parsed.action === "skills.team.set" ? parsed.teamSlug : null,
        { timeoutMs: config.requestTimeoutMs },
      );
      printCommandResult(parsed.json, result, () => {
        console.log(`Updated ${result.skill.skillId} team=${result.skill.teamSlug ?? "-"}.`);
      });
      return 0;
    }

    return failWithUsage("skillmd org: unsupported argument(s)", ORG_USAGE);
  } catch (error) {
    if (isOrgApiError(error)) {
      console.error(formatCliApiErrorWithHint("skillmd org", error));
      return 1;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd org: ${message}`);
    return 1;
  }
}
