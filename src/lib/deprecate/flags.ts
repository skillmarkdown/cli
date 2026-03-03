import { valid as isValidSemver, validRange as isValidSemverRange } from "semver";

import { type DeprecateFlags, type ParsedDeprecateRequest } from "./types";

const SEMVER_PATTERN = new RegExp(
  "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
    "(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?" +
    "(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$",
);

function splitSkillAndSelector(value: string): { skillId: string; range: string } | null {
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }

  const skillId = value.slice(0, separator);
  const range = value.slice(separator + 1).trim();
  if (!skillId || !range) {
    return null;
  }

  return { skillId, range };
}

function isCanonicalSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value) && Boolean(isValidSemver(value));
}

function isValidDeprecationSelector(value: string): boolean {
  if (isCanonicalSemver(value)) {
    return true;
  }

  return Boolean(isValidSemverRange(value));
}

export function parseDeprecateFlags(args: string[]): DeprecateFlags {
  let json = false;
  let message: string | undefined;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--message") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { valid: false, json: false };
      }
      message = value.trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--message=")) {
      message = arg.slice("--message=".length).trim();
      continue;
    }

    if (arg.startsWith("-")) {
      return { valid: false, json: false };
    }

    positional.push(arg);
  }

  if (positional.length !== 1 || !message) {
    return { valid: false, json: false };
  }

  return {
    valid: true,
    json,
    skillWithSelector: positional[0],
    message,
  };
}

export function parseDeprecateRequest(flags: DeprecateFlags): ParsedDeprecateRequest | null {
  if (!flags.valid || !flags.skillWithSelector || !flags.message) {
    return null;
  }

  const parsed = splitSkillAndSelector(flags.skillWithSelector);
  if (!parsed || !isValidDeprecationSelector(parsed.range)) {
    return null;
  }

  const message = flags.message.trim();
  if (!message) {
    return null;
  }

  return {
    skillId: parsed.skillId,
    range: parsed.range,
    message,
    json: flags.json,
  };
}
