import { splitJsonFlag } from "../shared/flag-parse";
import { type ParsedCollaboratorsFlags } from "./types";

function normalizeUsername(value: string | undefined): string {
  return value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
}

export function parseCollaboratorsFlags(args: string[]): ParsedCollaboratorsFlags {
  if (args.length === 0) {
    return { valid: false, json: false };
  }

  const action = args[0];
  if (action === "ls") {
    const parsed = splitJsonFlag(args);
    if (!parsed || parsed.positional.length !== 2) {
      return { valid: false, json: false };
    }
    const skillId = parsed.positional[1]?.trim();
    if (!skillId) {
      return { valid: false, json: false };
    }
    return { valid: true, action: "ls", skillId, json: parsed.json };
  }

  if (action === "add" || action === "rm") {
    const parsed = splitJsonFlag(args);
    if (!parsed || parsed.positional.length !== 3) {
      return { valid: false, json: false };
    }
    const skillId = parsed.positional[1]?.trim();
    const username = normalizeUsername(parsed.positional[2]);
    if (!skillId || !username) {
      return { valid: false, json: false };
    }
    return {
      valid: true,
      action,
      skillId,
      username,
      json: parsed.json,
    };
  }

  return { valid: false, json: false };
}
