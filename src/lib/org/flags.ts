import { parseOptionValue } from "../shared/flag-parse";
import { type OrganizationRole, type ParsedOrgFlags } from "./types";

function isRole(value: string): value is OrganizationRole {
  return value === "owner" || value === "admin" || value === "member";
}

function parseJson(positionalArgs: string[]): { positional: string[]; json: boolean } | null {
  const positional: string[] = [];
  let json = false;
  for (const arg of positionalArgs) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    positional.push(arg);
  }
  return { positional, json };
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

  return { valid: false, json: false };
}
