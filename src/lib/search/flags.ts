import { type SearchFlags } from "./types";
import { parseIntInRange, parseOptionValue } from "../shared/flag-parse";

const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 50;
const SEARCH_SCOPES = ["public", "private"] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];

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

function parseScope(value: string): SearchScope | null {
  return SEARCH_SCOPES.includes(value as SearchScope) ? (value as SearchScope) : null;
}

export function parseSearchFlags(args: string[]): SearchFlags {
  const invalid = (): SearchFlags => ({ scope: "public", json: false, valid: false });
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

    const parsedLimitValue = parseOptionValue(args, index, "limit");
    if (parsedLimitValue.matched) {
      const parsedLimit = parseIntInRange(
        parsedLimitValue.value ?? "",
        MIN_SEARCH_LIMIT,
        MAX_SEARCH_LIMIT,
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

    const parsedScopeValue = parseOptionValue(args, index, "scope");
    if (parsedScopeValue.matched) {
      const parsedScope = parseScope(parsedScopeValue.value ?? "");
      if (!parsedScope) {
        return invalid();
      }
      scope = parsedScope;
      index = parsedScopeValue.nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      return invalid();
    }

    if (query !== undefined) {
      return invalid();
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
