import { resolveReadIdToken as defaultResolveReadIdToken } from "../lib/auth/read-token";
import { resolveWriteAuth } from "../lib/auth/write-auth";
import { failWithUsage } from "../lib/shared/command-output";
import {
  getAuthRegistryEnvConfig,
  getLoginScopedRegistryEnvConfig,
} from "../lib/shared/env-config";
import { ORG_USAGE } from "../lib/shared/cli-text";
import { executeReadCommand, executeWriteCommand } from "../lib/shared/command-execution";
import {
  addOrganizationMember as defaultAddOrganizationMember,
  addOrganizationTeamMember as defaultAddOrganizationTeamMember,
  assignOrganizationSkillTeam as defaultAssignOrganizationSkillTeam,
  createOrganizationToken as defaultCreateOrganizationToken,
  createOrganizationTeam as defaultCreateOrganizationTeam,
  getOrganizationTeam as defaultGetOrganizationTeam,
  listOrganizationMembers as defaultListOrganizationMembers,
  listOrganizationSkills as defaultListOrganizationSkills,
  listOrganizationTokens as defaultListOrganizationTokens,
  listOrganizationTeams as defaultListOrganizationTeams,
  removeOrganizationMember as defaultRemoveOrganizationMember,
  removeOrganizationTeamMember as defaultRemoveOrganizationTeamMember,
  revokeOrganizationToken as defaultRevokeOrganizationToken,
} from "../lib/org/client";
import { isOrgApiError } from "../lib/org/errors";
import {
  type OrgEnvConfig,
  type CreatedOrganizationTokenResponse,
  type OrganizationMemberMutationResponse,
  type OrganizationMemberRemoveResponse,
  type OrganizationMembersResponse,
  type OrganizationMembership,
  type OrganizationRole,
  type OrganizationSkillTeamUpdateResponse,
  type OrganizationSkillsResponse,
  type OrganizationTokenRevokeResponse,
  type OrganizationTokensResponse,
  type OrganizationTeamCreateResponse,
  type OrganizationTeamMemberMutationResponse,
  type OrganizationTeamMemberRemoveResponse,
  type OrganizationTeamResponse,
  type OrganizationTeamsResponse,
  type OrganizationTokenScope,
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
  createOrganizationToken?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    request: { name: string; scope?: OrganizationTokenScope; expiresDays?: number },
    options?: { timeoutMs?: number },
  ) => Promise<CreatedOrganizationTokenResponse>;
  listOrganizationTokens?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTokensResponse>;
  revokeOrganizationToken?: (
    baseUrl: string,
    idToken: string,
    slug: string,
    tokenId: string,
    options?: { timeoutMs?: number },
  ) => Promise<OrganizationTokenRevokeResponse>;
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

function printOrganizationTokensHuman(payload: OrganizationTokensResponse): void {
  if (payload.tokens.length === 0) {
    console.log("No organization tokens found.");
    return;
  }

  for (const token of payload.tokens) {
    const revoked = token.revokedAt ? ` revoked=${token.revokedAt}` : "";
    const lastUsed = token.lastUsedAt ? ` lastUsed=${token.lastUsedAt}` : "";
    console.log(
      `${token.tokenId} ${token.scope} expires=${token.expiresAt} name="${token.name}"${revoked}${lastUsed}`,
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
      return executeReadCommand<{ organizations: OrganizationMembership[] }>({
        command: "skillmd org",
        json: parsed.json,
        resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
        run: async (idToken) => {
          const result = await (options.getWhoami ?? defaultGetWhoami)(
            config.registryBaseUrl,
            idToken,
            {
              timeoutMs: config.requestTimeoutMs,
            },
          );
          return { organizations: result.organizations ?? [] };
        },
        printHuman: (result) => printOrganizationListHuman(result.organizations),
        isApiError: isOrgApiError,
      });
    }

    const readActions = new Set([
      "members.ls",
      "team.ls",
      "team.members.ls",
      "skills.ls",
      "tokens.ls",
    ]);
    if (readActions.has(parsed.action)) {
      const config = (options.getReadConfig ?? getLoginScopedRegistryEnvConfig)(env);
      if (parsed.action === "members.ls") {
        return executeReadCommand<OrganizationMembersResponse>({
          command: "skillmd org",
          json: parsed.json,
          resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
          run: (idToken) =>
            (options.listOrganizationMembers ?? defaultListOrganizationMembers)(
              config.registryBaseUrl,
              idToken,
              parsed.slug,
              { timeoutMs: config.requestTimeoutMs },
            ),
          printHuman: printOrganizationMembersHuman,
          isApiError: isOrgApiError,
        });
      }

      if (parsed.action === "team.ls") {
        return executeReadCommand<OrganizationTeamsResponse>({
          command: "skillmd org",
          json: parsed.json,
          resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
          run: (idToken) =>
            (options.listOrganizationTeams ?? defaultListOrganizationTeams)(
              config.registryBaseUrl,
              idToken,
              parsed.slug,
              { timeoutMs: config.requestTimeoutMs },
            ),
          printHuman: printOrganizationTeamsHuman,
          isApiError: isOrgApiError,
        });
      }

      if (parsed.action === "team.members.ls") {
        return executeReadCommand<OrganizationTeamResponse>({
          command: "skillmd org",
          json: parsed.json,
          resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
          run: (idToken) =>
            (options.getOrganizationTeam ?? defaultGetOrganizationTeam)(
              config.registryBaseUrl,
              idToken,
              parsed.slug,
              parsed.teamSlug,
              { timeoutMs: config.requestTimeoutMs },
            ),
          printHuman: printOrganizationTeamHuman,
          isApiError: isOrgApiError,
        });
      }

      if (parsed.action === "tokens.ls") {
        return executeReadCommand<OrganizationTokensResponse>({
          command: "skillmd org",
          json: parsed.json,
          resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
          run: (idToken) =>
            (options.listOrganizationTokens ?? defaultListOrganizationTokens)(
              config.registryBaseUrl,
              idToken,
              parsed.slug,
              { timeoutMs: config.requestTimeoutMs },
            ),
          printHuman: printOrganizationTokensHuman,
          isApiError: isOrgApiError,
        });
      }

      return executeReadCommand<OrganizationSkillsResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveIdToken: options.resolveReadIdToken ?? (() => defaultResolveReadIdToken({ env })),
        run: (idToken) =>
          (options.listOrganizationSkills ?? defaultListOrganizationSkills)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: printOrganizationSkillsHuman,
        isApiError: isOrgApiError,
      });
    }

    const config = (options.getAuthConfig ?? getAuthRegistryEnvConfig)(env);
    const resolveOrgWriteAuth = async () => {
      const auth = await resolveWriteAuth({
        command: "skillmd org",
        env,
        config,
      });
      return auth.ok
        ? { ok: true as const, idToken: auth.value.idToken }
        : { ok: false as const, message: auth.message };
    };

    if (parsed.action === "members.add") {
      return executeWriteCommand<OrganizationMemberMutationResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.addOrganizationMember ?? defaultAddOrganizationMember)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            { username: parsed.username, role: parsed.role },
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Added ${result.owner} to @${result.slug} as ${result.role}.`);
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "members.rm") {
      return executeWriteCommand<OrganizationMemberRemoveResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.removeOrganizationMember ?? defaultRemoveOrganizationMember)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            parsed.username,
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Removed @${result.username} from @${result.slug}.`);
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "team.add") {
      return executeWriteCommand<OrganizationTeamCreateResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.createOrganizationTeam ?? defaultCreateOrganizationTeam)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            { teamSlug: parsed.teamSlug, name: parsed.name },
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Created team ${result.teamSlug} in @${result.slug}.`);
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "team.members.add") {
      return executeWriteCommand<OrganizationTeamMemberMutationResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.addOrganizationTeamMember ?? defaultAddOrganizationTeamMember)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            parsed.teamSlug,
            { username: parsed.username },
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Added ${result.owner} to team ${result.teamSlug} in @${result.slug}.`);
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "team.members.rm") {
      return executeWriteCommand<OrganizationTeamMemberRemoveResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.removeOrganizationTeamMember ?? defaultRemoveOrganizationTeamMember)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            parsed.teamSlug,
            parsed.username,
            {
              timeoutMs: config.requestTimeoutMs,
            },
          ),
        printHuman: (result) => {
          console.log(
            `Removed @${result.username} from team ${result.teamSlug} in @${result.slug}.`,
          );
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "skills.team.set" || parsed.action === "skills.team.clear") {
      return executeWriteCommand<OrganizationSkillTeamUpdateResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.assignOrganizationSkillTeam ?? defaultAssignOrganizationSkillTeam)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            parsed.skillSlug,
            parsed.action === "skills.team.set" ? parsed.teamSlug : null,
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Updated ${result.skill.skillId} team=${result.skill.teamSlug ?? "-"}.`);
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "tokens.add") {
      return executeWriteCommand<CreatedOrganizationTokenResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.createOrganizationToken ?? defaultCreateOrganizationToken)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            {
              name: parsed.name,
              scope: parsed.scope,
              expiresDays: parsed.days,
            },
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(
            `Created organization token ${result.tokenId} (${result.scope}, expires ${result.expiresAt}).`,
          );
          console.log(`Token: ${result.token}`);
        },
        isApiError: isOrgApiError,
      });
    }

    if (parsed.action === "tokens.rm") {
      return executeWriteCommand<OrganizationTokenRevokeResponse>({
        command: "skillmd org",
        json: parsed.json,
        resolveAuth: resolveOrgWriteAuth,
        run: (idToken) =>
          (options.revokeOrganizationToken ?? defaultRevokeOrganizationToken)(
            config.registryBaseUrl,
            idToken,
            parsed.slug,
            parsed.tokenId,
            { timeoutMs: config.requestTimeoutMs },
          ),
        printHuman: (result) => {
          console.log(`Revoked organization token ${result.tokenId}.`);
        },
        isApiError: isOrgApiError,
      });
    }

    return failWithUsage("skillmd org: unsupported argument(s)", ORG_USAGE);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd org: ${message}`);
    return 1;
  }
}
