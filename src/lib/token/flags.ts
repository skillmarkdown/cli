import { type ParsedTokenFlags, type TokenScope } from "./types";

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
      if (current === "--scope") {
        const next = args[index + 1];
        if (!next || !isScope(next)) {
          return { valid: false, json: false };
        }
        scope = next;
        index += 1;
        continue;
      }
      if (current === "--days") {
        const next = args[index + 1];
        if (!next || !/^\d+$/u.test(next)) {
          return { valid: false, json: false };
        }
        const parsedDays = Number.parseInt(next, 10);
        if (parsedDays < MIN_DAYS || parsedDays > MAX_DAYS) {
          return { valid: false, json: false };
        }
        days = parsedDays;
        index += 1;
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
