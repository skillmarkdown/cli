import { parseOptionValue } from "../shared/flag-parse";
import { type ParsedTeamFlags, type TeamRole } from "./types";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;

function normalizeSlug(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase().replace(/^@+/, "");
  if (!SLUG_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function parseJsonFlag(args: string[], startIndex: number): boolean | null {
  let json = false;
  for (let index = startIndex; index < args.length; index += 1) {
    if (args[index] !== "--json") {
      return null;
    }
    json = true;
  }
  return json;
}

function parseCreate(args: string[]): ParsedTeamFlags {
  const team = normalizeSlug(args[1]);
  if (!team) {
    return { valid: false, json: false };
  }

  let displayName: string | null = null;
  let json = false;

  for (let index = 2; index < args.length; index += 1) {
    if (args[index] === "--json") {
      json = true;
      continue;
    }
    const displayNameOption = parseOptionValue(args, index, "display-name");
    if (displayNameOption.matched) {
      const value = displayNameOption.value?.trim() ?? "";
      if (!value) {
        return { valid: false, json: false };
      }
      displayName = value;
      index = displayNameOption.nextIndex;
      continue;
    }
    return { valid: false, json: false };
  }

  return {
    valid: true,
    action: "create",
    team,
    displayName,
    json,
  };
}

function parseView(args: string[]): ParsedTeamFlags {
  const team = normalizeSlug(args[1]);
  if (!team) {
    return { valid: false, json: false };
  }

  const json = parseJsonFlag(args, 2);
  if (json === null) {
    return { valid: false, json: false };
  }

  return {
    valid: true,
    action: "view",
    team,
    json,
  };
}

function parseMemberRole(value: string | undefined): Exclude<TeamRole, "owner"> | null {
  if (!value) {
    return null;
  }
  if (value === "admin" || value === "member") {
    return value;
  }
  return null;
}

function parseMembers(args: string[]): ParsedTeamFlags {
  const action = args[1];

  if (action === "ls") {
    const team = normalizeSlug(args[2]);
    if (!team) {
      return { valid: false, json: false };
    }
    const json = parseJsonFlag(args, 3);
    if (json === null) {
      return { valid: false, json: false };
    }
    return { valid: true, action: "members_ls", team, json };
  }

  if (action === "add") {
    const team = normalizeSlug(args[2]);
    const ownerLogin = normalizeSlug(args[3]);
    if (!team || !ownerLogin) {
      return { valid: false, json: false };
    }

    let role: Exclude<TeamRole, "owner"> = "member";
    let json = false;

    for (let index = 4; index < args.length; index += 1) {
      if (args[index] === "--json") {
        json = true;
        continue;
      }
      const roleOption = parseOptionValue(args, index, "role");
      if (roleOption.matched) {
        if (roleOption.value !== "admin" && roleOption.value !== "member") {
          return { valid: false, json: false };
        }
        role = roleOption.value;
        index = roleOption.nextIndex;
        continue;
      }
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action: "members_add",
      team,
      ownerLogin,
      role,
      json,
    };
  }

  if (action === "set-role") {
    const team = normalizeSlug(args[2]);
    const ownerLogin = normalizeSlug(args[3]);
    const role = parseMemberRole(args[4]);
    if (!team || !ownerLogin || !role) {
      return { valid: false, json: false };
    }

    const json = parseJsonFlag(args, 5);
    if (json === null) {
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action: "members_set_role",
      team,
      ownerLogin,
      role,
      json,
    };
  }

  if (action === "rm") {
    const team = normalizeSlug(args[2]);
    const ownerLogin = normalizeSlug(args[3]);
    if (!team || !ownerLogin) {
      return { valid: false, json: false };
    }

    const json = parseJsonFlag(args, 4);
    if (json === null) {
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action: "members_rm",
      team,
      ownerLogin,
      json,
    };
  }

  return { valid: false, json: false };
}

export function parseTeamFlags(args: string[]): ParsedTeamFlags {
  if (args.length < 2) {
    return { valid: false, json: false };
  }

  const subcommand = args[0];
  if (subcommand === "create") {
    return parseCreate(args);
  }
  if (subcommand === "view") {
    return parseView(args);
  }
  if (subcommand === "members") {
    return parseMembers(args);
  }
  return { valid: false, json: false };
}
