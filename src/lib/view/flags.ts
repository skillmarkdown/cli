import { type ViewFlags } from "./types";

export function parseViewFlags(args: string[]): ViewFlags {
  let skillId: string | undefined;
  let json = false;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { json: false, valid: false };
    }

    if (skillId !== undefined) {
      return { json: false, valid: false };
    }

    skillId = arg;
  }

  if (!skillId) {
    return { json: false, valid: false };
  }

  return {
    skillId,
    json,
    valid: true,
  };
}
