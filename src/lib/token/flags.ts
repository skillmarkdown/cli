import { type ParsedTokenFlags, type TokenScope } from "./types";
import { parseIntInRange, parseOptionValue } from "../shared/flag-parse";

const DEFAULT_SCOPE: TokenScope = "publish";
const DEFAULT_DAYS = 30;
const MIN_DAYS = 1;
const MAX_DAYS = 365;
const TOKEN_ID_PATTERN = /^tok_[a-z0-9]{16,64}$/;

function isScope(value: string): value is TokenScope {
  return value === "read" || value === "publish" || value === "admin";
}

export function parseTokenFlags(args: string[]): ParsedTokenFlags {
  if (args.length === 0) {
    return { valid: false, json: false };
  }

  const action = args[0];
  if (action === "ls") {
    if (args.length === 1) {
      return { valid: true, action: "ls", json: false };
    }
    if (args.length === 2 && args[1] === "--json") {
      return { valid: true, action: "ls", json: true };
    }
    return { valid: false, json: false };
  }

  if (action === "rm") {
    const tokenId = args[1];
    if (!tokenId || !TOKEN_ID_PATTERN.test(tokenId)) {
      return { valid: false, json: false };
    }

    let json = false;
    for (let index = 2; index < args.length; index += 1) {
      if (args[index] === "--json") {
        json = true;
        continue;
      }
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action: "rm",
      tokenId,
      json,
    };
  }

  if (action === "add") {
    const name = args[1]?.trim();
    if (!name) {
      return { valid: false, json: false };
    }

    let scope: TokenScope = DEFAULT_SCOPE;
    let days = DEFAULT_DAYS;
    let json = false;

    for (let index = 2; index < args.length; index += 1) {
      const current = args[index];
      if (current === "--json") {
        json = true;
        continue;
      }
      const scopeOption = parseOptionValue(args, index, "scope");
      if (scopeOption.matched) {
        if (!scopeOption.value || !isScope(scopeOption.value)) {
          return { valid: false, json: false };
        }
        scope = scopeOption.value;
        index = scopeOption.nextIndex;
        continue;
      }
      const daysOption = parseOptionValue(args, index, "days");
      if (daysOption.matched) {
        const parsedDays = parseIntInRange(daysOption.value ?? "", MIN_DAYS, MAX_DAYS);
        if (parsedDays === null) {
          return { valid: false, json: false };
        }
        days = parsedDays;
        index = daysOption.nextIndex;
        continue;
      }
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action: "add",
      name,
      scope,
      days,
      json,
    };
  }

  return { valid: false, json: false };
}
