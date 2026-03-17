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
    const slug = parsed.positional[1]?.trim();
    if (!slug) {
      return { valid: false, json: false };
    }
    return { valid: true, action: "create", slug, json: parsed.json };
  }

  if (section === "members") {
    if (subsection === "ls") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "members.ls", slug: parsed.positional[2], json: parsed.json };
    }

    if (subsection === "rm") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 4) {
        return { valid: false, json: false };
      }
      return {
        valid: true,
        action: "members.rm",
        slug: parsed.positional[2],
        username: parsed.positional[3],
        json: parsed.json,
      };
    }

    if (subsection === "add") {
      const slug = args[2]?.trim();
      const username = args[3]?.trim();
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
  }

  if (section === "team") {
    if (subsection === "ls") {
      const parsed = parseJson(args);
      if (!parsed || parsed.positional.length !== 3) {
        return { valid: false, json: false };
      }
      return { valid: true, action: "team.ls", slug: parsed.positional[2], json: parsed.json };
    }

    if (subsection === "add") {
      const slug = args[2]?.trim();
      const teamSlug = args[3]?.trim();
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
          slug: parsed.positional[3],
          teamSlug: parsed.positional[4],
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
          slug: parsed.positional[3],
          teamSlug: parsed.positional[4],
          username: parsed.positional[5],
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
      return { valid: true, action: "skills.ls", slug: parsed.positional[2], json: parsed.json };
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
          slug: parsed.positional[3],
          skillSlug: parsed.positional[4],
          teamSlug: parsed.positional[5],
          json: parsed.json,
        };
      }
      if (action === "clear" && parsed.positional.length === 5) {
        return {
          valid: true,
          action: "skills.team.clear",
          slug: parsed.positional[3],
          skillSlug: parsed.positional[4],
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
      return { valid: true, action: "tokens.ls", slug: parsed.positional[2], json: parsed.json };
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
        slug: parsed.positional[2],
        tokenId,
        json: parsed.json,
      };
    }

    if (subsection === "add") {
      const slug = args[2]?.trim();
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
