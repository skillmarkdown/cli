import { type UpdateFlags } from "./types";

export function parseUpdateFlags(args: string[]): UpdateFlags {
  const skillIds: string[] = [];
  let all = false;
  let allowYanked = false;
  let json = false;

  for (const arg of args) {
    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--allow-yanked") {
      allowYanked = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return {
        all: false,
        allowYanked: false,
        json: false,
        skillIds: [],
        valid: false,
      };
    }

    skillIds.push(arg);
  }

  if (all && skillIds.length > 0) {
    return {
      all: false,
      allowYanked: false,
      json: false,
      skillIds: [],
      valid: false,
    };
  }

  return {
    all,
    allowYanked,
    json,
    skillIds,
    valid: true,
  };
}
