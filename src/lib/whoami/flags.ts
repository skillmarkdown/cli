import { type ParsedWhoamiFlags } from "./types";

const JSON_FLAG = "--json";

export function parseWhoamiFlags(args: string[]): ParsedWhoamiFlags {
  let json = false;
  for (const arg of args) {
    if (arg === JSON_FLAG) {
      json = true;
      continue;
    }

    return { valid: false, json: false };
  }

  return { valid: true, json };
}
