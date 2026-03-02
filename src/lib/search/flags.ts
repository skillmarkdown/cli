import { type SearchFlags } from "./types";

const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 50;

function parseValueArg(
  args: string[],
  index: number,
  options: {
    allowHyphenPrefixedValue?: boolean;
    rejectKnownFlagValues?: boolean;
  } = {},
): { value?: string; nextIndex: number } {
  const value = args[index + 1];
  if (!value) {
    return { nextIndex: index };
  }

  if (options.rejectKnownFlagValues && isKnownFlagToken(value)) {
    return { nextIndex: index };
  }

  if (!options.allowHyphenPrefixedValue && value.startsWith("-")) {
    return { nextIndex: index };
  }

  return { value, nextIndex: index + 1 };
}

function isKnownFlagToken(value: string): boolean {
  return (
    value === "--json" ||
    value === "--limit" ||
    value === "--cursor" ||
    value.startsWith("--limit=") ||
    value.startsWith("--cursor=")
  );
}

function parseLimit(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_SEARCH_LIMIT || parsed > MAX_SEARCH_LIMIT) {
    return null;
  }

  return parsed;
}

export function parseSearchFlags(args: string[]): SearchFlags {
  let query: string | undefined;
  let limit: number | undefined;
  let cursor: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--limit") {
      const parsedValue = parseValueArg(args, index);
      if (!parsedValue.value) {
        return { json: false, valid: false };
      }

      const parsedLimit = parseLimit(parsedValue.value);
      if (parsedLimit === null) {
        return { json: false, valid: false };
      }

      limit = parsedLimit;
      index = parsedValue.nextIndex;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const parsedLimit = parseLimit(arg.slice("--limit=".length));
      if (parsedLimit === null) {
        return { json: false, valid: false };
      }

      limit = parsedLimit;
      continue;
    }

    if (arg === "--cursor") {
      const parsedValue = parseValueArg(args, index, {
        allowHyphenPrefixedValue: true,
        rejectKnownFlagValues: true,
      });
      if (!parsedValue.value) {
        return { json: false, valid: false };
      }

      cursor = parsedValue.value;
      index = parsedValue.nextIndex;
      continue;
    }

    if (arg.startsWith("--cursor=")) {
      cursor = arg.slice("--cursor=".length);
      if (!cursor) {
        return { json: false, valid: false };
      }
      continue;
    }

    if (arg.startsWith("-")) {
      return { json: false, valid: false };
    }

    if (query !== undefined) {
      return { json: false, valid: false };
    }

    query = arg;
  }

  return {
    query,
    limit,
    cursor,
    json,
    valid: true,
  };
}
