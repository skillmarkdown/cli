import { parseIntInRange, parseOptionValue, splitJsonFlag } from "../shared/flag-parse";
import { type OrganizationRole, type OrganizationTokenScope, type ParsedOrgFlags } from "./types";

const DEFAULT_TOKEN_DAYS = 30;
const MIN_TOKEN_DAYS = 1;
const MAX_TOKEN_DAYS = 365;
const TOKEN_ID_PATTERN = /^tok_[a-z0-9]{16,64}$/;

function isRole(value: string): value is OrganizationRole {
  return value === "owner" || value === "admin" || value === "member";
}

function isTokenScope(value: string): value is OrganizationTokenScope {
  return value === "publish" || value === "admin";
}

function parseJson(positionalArgs: string[]): { positional: string[]; json: boolean } | null {
  return splitJsonFlag(positionalArgs);
}

function normalizeIdentity(value: string | undefined): string {
  return value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
}

export function parseOrgFlags(args: string[]): ParsedOrgFlags {
  if (args.length === 0) {
    return { valid: false, json: false };
  }

  const [section, subsection, action] = args;

  if (section === "ls") {
    const parsed = parseJson(args);
    if (!parsed || parsed.positional.length !== 1) {
      return { valid: false, json: false };
    }
    return { valid: true, action: "ls", json: parsed.json };
  }

  if (section === "create") {
    const parsed = parseJson(args);
    if (!parsed || parsed.positional.length !== 2) {
      return { valid: false, json: false };
    }
    const slug = normalizeIdentity(parsed.positional[1]);
    if (!slug) {
      return { valid: false, json: false };
    }
    return { valid: true, action: "create", slug, json: parsed.json };
  }

  if (section === "get") {
    const parsed = parseJson(args);
    if (!parsed || parsed.positional.length !== 2) {
      return { valid: false, json: false };
    }
    const slug = normalizeIdentity(parsed.positional[1]);
    if (!slug) {
      return { valid: false, json: false };
    }
    return { valid: true, action: "get", slug, json: parsed.json };
  }

  if (section === "rm") {
    const slug = normalizeIdentity(args[1]);
    if (!slug) {
      return { valid: false, json: false };
    }
    let confirm: string | undefined;
    let json = false;
    for (let index = 2; index < args.length; index += 1) {
      const current = args[index];
      if (current === "--json") {
        json = true;
        continue;
      }
      const confirmOption = parseOptionValue(args, index, "confirm");
      if (confirmOption.matched) {
        confirm = normalizeIdentity(confirmOption.value);
        if (!confirm) {
          return { valid: false, json: false };
        }
        index = confirmOption.nextIndex;
        continue;
      }
      return { valid: false, json: false };
    }
    return { valid: true, action: "rm", slug, confirm, json };
  }

  if (section === "members") {
    if (subsection === "ls") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      const slug = normalizeIdentity(parsed.positional[2]);
      if (!slug) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "members.ls", slug, json: parsed.json };
    }

    if (subsection === "rm") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 4) {
        return { valid: false, json: false };
      }
      const slug = normalizeIdentity(parsed.positional[2]);
      const username = normalizeIdentity(parsed.positional[3]);
      if (!slug || !username) {
        return { valid: false, json: false };
      }
      return {
        valid: true,
        action: "members.rm",
        slug,
        username,
        json: parsed.json,
      };
    }

    if (subsection === "add") {
      const slug = normalizeIdentity(args[2]);
      const username = normalizeIdentity(args[3]);
      if (!slug || !username) {
        return { valid: false, json: false };
      }
      let role: OrganizationRole = "member";
      let json = false;
      for (let index = 4; index < args.length; index += 1) {
        const current = args[index];
        if (current === "--json") {
          json = true;
          continue;
        }
        const roleOption = parseOptionValue(args, index, "role");
        if (roleOption.matched) {
          if (!roleOption.value || !isRole(roleOption.value)) {
            return { valid: false, json: false };
          }
          role = roleOption.value;
          index = roleOption.nextIndex;
          continue;
        }
        return { valid: false, json: false };
      }
      return { valid: true, action: "members.add", slug, username, role, json };
    }

    if (subsection === "set-role") {
      const slug = normalizeIdentity(args[2]);
      const username = normalizeIdentity(args[3]);
      if (!slug || !username) {
        return { valid: false, json: false };
      }
      let role: OrganizationRole | null = null;
      let json = false;
      for (let index = 4; index < args.length; index += 1) {
        const current = args[index];
        if (current === "--json") {
          json = true;
          continue;
        }
        const roleOption = parseOptionValue(args, index, "role");
        if (roleOption.matched) {
          if (!roleOption.value || !isRole(roleOption.value)) {
            return { valid: false, json: false };
          }
          role = roleOption.value;
          index = roleOption.nextIndex;
          continue;
        }
        return { valid: false, json: false };
      }
      if (!role) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "members.set-role", slug, username, role, json };
    }
  }

  if (section === "avatar") {
    if (subsection === "clear") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      const slug = normalizeIdentity(parsed.positional[2]);
      if (!slug) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "avatar.clear", slug, json: parsed.json };
    }

    if (subsection === "set") {
      const slug = normalizeIdentity(args[2]);
      if (!slug) {
        return { valid: false, json: false };
      }
      let avatarUrl = "";
      let json = false;
      for (let index = 3; index < args.length; index += 1) {
        const current = args[index];
        if (current === "--json") {
          json = true;
          continue;
        }
        const urlOption = parseOptionValue(args, index, "url");
        if (urlOption.matched) {
          avatarUrl = urlOption.value?.trim() ?? "";
          if (!avatarUrl) {
            return { valid: false, json: false };
          }
          index = urlOption.nextIndex;
          continue;
        }
        return { valid: false, json: false };
      }
      if (!avatarUrl) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "avatar.set", slug, avatarUrl, json };
    }
  }

  if (section === "team") {
    if (subsection === "ls") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      const slug = normalizeIdentity(parsed.positional[2]);
      if (!slug) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "team.ls", slug, json: parsed.json };
    }

    if (subsection === "add") {
      const slug = normalizeIdentity(args[2]);
      const teamSlug = normalizeIdentity(args[3]);
      if (!slug || !teamSlug) {
        return { valid: false, json: false };
      }
      let name = "";
      let json = false;
      for (let index = 4; index < args.length; index += 1) {
        const current = args[index];
        if (current === "--json") {
          json = true;
          continue;
        }
        const nameOption = parseOptionValue(args, index, "name");
        if (nameOption.matched) {
          name = nameOption.value?.trim() ?? "";
          if (!name) {
            return { valid: false, json: false };
          }
          index = nameOption.nextIndex;
          continue;
        }
        return { valid: false, json: false };
      }
      if (!name) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "team.add", slug, teamSlug, name, json };
    }

    if (subsection === "members") {
      if (action === "ls") {
        const parsed = parseJson(args);
        if (!parsed || parsed.positional.length !== 5) {
          return { valid: false, json: false };
        }
        return {
          valid: true,
          action: "team.members.ls",
          slug: normalizeIdentity(parsed.positional[3]),
          teamSlug: normalizeIdentity(parsed.positional[4]),
          json: parsed.json,
        };
      }

      if (action === "add" || action === "rm") {
        const parsed = parseJson(args);
        if (!parsed || parsed.positional.length !== 6) {
          return { valid: false, json: false };
        }
        return {
          valid: true,
          action: action === "add" ? "team.members.add" : "team.members.rm",
          slug: normalizeIdentity(parsed.positional[3]),
          teamSlug: normalizeIdentity(parsed.positional[4]),
          username: normalizeIdentity(parsed.positional[5]),
          json: parsed.json,
        };
      }
    }
  }

  if (section === "skills") {
    if (subsection === "ls") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      const slug = normalizeIdentity(parsed.positional[2]);
      if (!slug) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "skills.ls", slug, json: parsed.json };
    }

    if (subsection === "team" && (action === "set" || action === "clear")) {
      const parsed = parseJson(args);
      if (!parsed) {
        return { valid: false, json: false };
      }
      if (action === "set" && parsed.positional.length === 6) {
        return {
          valid: true,
          action: "skills.team.set",
          slug: normalizeIdentity(parsed.positional[3]),
          skillSlug: normalizeIdentity(parsed.positional[4]),
          teamSlug: normalizeIdentity(parsed.positional[5]),
          json: parsed.json,
        };
      }
      if (action === "clear" && parsed.positional.length === 5) {
        return {
          valid: true,
          action: "skills.team.clear",
          slug: normalizeIdentity(parsed.positional[3]),
          skillSlug: normalizeIdentity(parsed.positional[4]),
          json: parsed.json,
        };
      }
    }
  }

  if (section === "tokens") {
    if (subsection === "ls") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      const slug = normalizeIdentity(parsed.positional[2]);
      if (!slug) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "tokens.ls", slug, json: parsed.json };
    }

    if (subsection === "rm") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 4) {
        return { valid: false, json: false };
      }
      const tokenId = parsed.positional[3];
      if (!TOKEN_ID_PATTERN.test(tokenId)) {
        return { valid: false, json: false };
      }
      return {
        valid: true,
        action: "tokens.rm",
        slug: normalizeIdentity(parsed.positional[2]),
        tokenId,
        json: parsed.json,
      };
    }

    if (subsection === "add") {
      const slug = normalizeIdentity(args[2]);
      const name = args[3]?.trim();
      if (!slug || !name) {
        return { valid: false, json: false };
      }
      let scope: OrganizationTokenScope = "publish";
      let days = DEFAULT_TOKEN_DAYS;
      let json = false;
      for (let index = 4; index < args.length; index += 1) {
        const current = args[index];
        if (current === "--json") {
          json = true;
          continue;
        }
        const scopeOption = parseOptionValue(args, index, "scope");
        if (scopeOption.matched) {
          if (!scopeOption.value || !isTokenScope(scopeOption.value)) {
            return { valid: false, json: false };
          }
          scope = scopeOption.value;
          index = scopeOption.nextIndex;
          continue;
        }
        const daysOption = parseOptionValue(args, index, "days");
        if (daysOption.matched) {
          const parsedDays = parseIntInRange(
            daysOption.value ?? "",
            MIN_TOKEN_DAYS,
            MAX_TOKEN_DAYS,
          );
          if (parsedDays === null) {
            return { valid: false, json: false };
          }
          days = parsedDays;
          index = daysOption.nextIndex;
          continue;
        }
        return { valid: false, json: false };
      }
      return { valid: true, action: "tokens.add", slug, name, scope, days, json };
    }
  }

  return { valid: false, json: false };
}
