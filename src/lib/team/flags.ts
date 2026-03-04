import { parseOptionValue } from "../shared/flag-parse";
import { type MutableTeamRole, type ParsedTeamFlags } from "./types";

const INVALID: ParsedTeamFlags = { valid: false, json: false };
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;

function normalizeSlug(raw?: string): string | null {
  const normalized = raw?.trim().toLowerCase().replace(/^@+/, "") ?? "";
  return SLUG_PATTERN.test(normalized) ? normalized : null;
}

function parseTailJson(args: string[], start: number): boolean | null {
  for (let index = start; index < args.length; index += 1) {
    if (args[index] !== "--json") {
      return null;
    }
  }
  return args.length > start;
}

function parseCreate(args: string[]): ParsedTeamFlags {
  const team = normalizeSlug(args[1]);
  if (!team) {
    return INVALID;
  }
  let displayName: string | null = null;
  let json = false;
  for (let index = 2; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--json") {
      json = true;
      continue;
    }
    const opt = parseOptionValue(args, index, "display-name");
    const value = opt.value?.trim();
    if (!opt.matched || !value) {
      return INVALID;
    }
    displayName = value;
    index = opt.nextIndex;
  }
  return { valid: true, action: "create", team, displayName, json };
}

function parseMembers(args: string[]): ParsedTeamFlags {
  const action = args[1];
  const team = normalizeSlug(args[2]);
  if (!team) {
    return INVALID;
  }

  if (action === "ls") {
    const jsonTail = parseTailJson(args, 3);
    return jsonTail === null
      ? INVALID
      : { valid: true, action: "members_ls", team, json: jsonTail };
  }

  const ownerLogin = normalizeSlug(args[3]);
  if (!ownerLogin) {
    return INVALID;
  }

  if (action === "rm") {
    const jsonTail = parseTailJson(args, 4);
    return jsonTail === null
      ? INVALID
      : { valid: true, action: "members_rm", team, ownerLogin, json: jsonTail };
  }

  if (action === "set-role") {
    const role = args[4] as MutableTeamRole;
    if (role !== "admin" && role !== "member") {
      return INVALID;
    }
    const jsonTail = parseTailJson(args, 5);
    return jsonTail === null
      ? INVALID
      : { valid: true, action: "members_set_role", team, ownerLogin, role, json: jsonTail };
  }

  if (action === "add") {
    let role: MutableTeamRole = "member";
    let json = false;
    for (let index = 4; index < args.length; index += 1) {
      const current = args[index];
      if (current === "--json") {
        json = true;
        continue;
      }
      const opt = parseOptionValue(args, index, "role");
      if (!opt.matched || (opt.value !== "admin" && opt.value !== "member")) {
        return INVALID;
      }
      role = opt.value;
      index = opt.nextIndex;
    }
    return { valid: true, action: "members_add", team, ownerLogin, role, json };
  }

  return INVALID;
}

export function parseTeamFlags(args: string[]): ParsedTeamFlags {
  if (args.length < 2) {
    return INVALID;
  }
  if (args[0] === "create") {
    return parseCreate(args);
  }
  if (args[0] === "view") {
    const team = normalizeSlug(args[1]);
    const jsonTail = team ? parseTailJson(args, 2) : null;
    return !team || jsonTail === null
      ? INVALID
      : { valid: true, action: "view", team, json: jsonTail };
  }
  return args[0] === "members" ? parseMembers(args) : INVALID;
}
