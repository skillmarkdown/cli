import { type HistoryFlags } from "./types";
import { parseIntInRange, parseOptionValue } from "../shared/flag-parse";

const MIN_HISTORY_LIMIT = 1;
const MAX_HISTORY_LIMIT = 50;

function isKnownFlagToken(value: string): boolean {
  return (
    value === "--json" ||
    value === "--limit" ||
    value === "--cursor" ||
    value.startsWith("--limit=") ||
    value.startsWith("--cursor=")
  );
}

export function parseHistoryFlags(args: string[]): HistoryFlags {
  const invalid = (): HistoryFlags => ({ json: false, valid: false });
  let skillId: string | undefined;
  let limit: number | undefined;
  let cursor: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    const parsedLimitValue = parseOptionValue(args, index, "limit");
    if (parsedLimitValue.matched) {
      const parsedLimit = parseIntInRange(
        parsedLimitValue.value ?? "",
        MIN_HISTORY_LIMIT,
        MAX_HISTORY_LIMIT,
      );
      if (parsedLimit === null) {
        return invalid();
      }
      limit = parsedLimit;
      index = parsedLimitValue.nextIndex;
      continue;
    }

    const parsedCursorValue = parseOptionValue(args, index, "cursor", {
      allowHyphenPrefixedValue: true,
      rejectKnownFlagValues: true,
      isKnownFlagToken,
    });
    if (parsedCursorValue.matched) {
      if (!parsedCursorValue.value) {
        return invalid();
      }
      cursor = parsedCursorValue.value;
      index = parsedCursorValue.nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      return invalid();
    }

    if (skillId !== undefined) {
      return invalid();
    }

    skillId = arg;
  }

  if (!skillId) {
    return invalid();
  }

  return {
    skillId,
    limit,
    cursor,
    json,
    valid: true,
  };
}
