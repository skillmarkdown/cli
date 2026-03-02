import { type SearchFlags } from "./types";

const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 50;
const SEARCH_SCOPES = ["public", "private"] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];

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
    value === "--scope" ||
    value === "--cursor" ||
    value.startsWith("--limit=") ||
    value.startsWith("--scope=") ||
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

function parseScope(value: string): SearchScope | null {
  return SEARCH_SCOPES.includes(value as SearchScope) ? (value as SearchScope) : null;
}

export function parseSearchFlags(args: string[]): SearchFlags {
  let query: string | undefined;
  let limit: number | undefined;
  let cursor: string | undefined;
  let scope: SearchScope = "public";
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
        return { scope: "public", json: false, valid: false };
      }

      const parsedLimit = parseLimit(parsedValue.value);
      if (parsedLimit === null) {
        return { scope: "public", json: false, valid: false };
      }

      limit = parsedLimit;
      index = parsedValue.nextIndex;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const parsedLimit = parseLimit(arg.slice("--limit=".length));
      if (parsedLimit === null) {
        return { scope: "public", json: false, valid: false };
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
        return { scope: "public", json: false, valid: false };
      }

      cursor = parsedValue.value;
      index = parsedValue.nextIndex;
      continue;
    }

    if (arg.startsWith("--cursor=")) {
      cursor = arg.slice("--cursor=".length);
      if (!cursor) {
        return { scope: "public", json: false, valid: false };
      }
      continue;
    }

    if (arg === "--scope") {
      const parsedValue = parseValueArg(args, index);
      if (!parsedValue.value) {
        return { scope: "public", json: false, valid: false };
      }
      const parsedScope = parseScope(parsedValue.value);
      if (!parsedScope) {
        return { scope: "public", json: false, valid: false };
      }
      scope = parsedScope;
      index = parsedValue.nextIndex;
      continue;
    }

    if (arg.startsWith("--scope=")) {
      const parsedScope = parseScope(arg.slice("--scope=".length));
      if (!parsedScope) {
        return { scope: "public", json: false, valid: false };
      }
      scope = parsedScope;
      continue;
    }

    if (arg.startsWith("-")) {
      return { scope: "public", json: false, valid: false };
    }

    if (query !== undefined) {
      return { scope: "public", json: false, valid: false };
    }

    query = arg;
  }

  return {
    query,
    limit,
    cursor,
    scope,
    json,
    valid: true,
  };
}
