import { valid as isValidSemver, validRange as asValidSemverRange } from "semver";
import { type ParsedTagFlags } from "./types";

const TAG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SEMVER_PATTERN = new RegExp(
  "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
    "(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?" +
    "(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$",
);

function splitSkillAndVersion(value: string): { skillId: string; version: string } | null {
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }

  const skillId = value.slice(0, separator);
  const version = value.slice(separator + 1);
  if (!skillId || !version || !SEMVER_PATTERN.test(version)) {
    return null;
  }

  return {
    skillId,
    version,
  };
}

function parseTag(value: string): string | null {
  if (!TAG_PATTERN.test(value)) {
    return null;
  }

  if (isValidSemver(value)) {
    return null;
  }

  if (asValidSemverRange(value)) {
    return null;
  }

  return value;
}

export function parseTagFlags(args: string[]): ParsedTagFlags {
  if (args.length === 0) {
    return { valid: false, json: false };
  }

  let json = false;
  const positional: string[] = [];
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { valid: false, json: false };
    }

    positional.push(arg);
  }

  if (positional.length === 0) {
    return { valid: false, json: false };
  }

  const action = positional[0];
  if (action === "ls") {
    if (positional.length !== 2) {
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action,
      skillId: positional[1],
      json,
    };
  }

  if (action === "add") {
    if (positional.length !== 3) {
      return { valid: false, json: false };
    }

    const skillWithVersion = splitSkillAndVersion(positional[1]);
    const tag = parseTag(positional[2]);
    if (!skillWithVersion || !tag) {
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action,
      skillId: skillWithVersion.skillId,
      version: skillWithVersion.version,
      tag,
      json,
    };
  }

  if (action === "rm") {
    if (positional.length !== 3) {
      return { valid: false, json: false };
    }

    const tag = parseTag(positional[2]);
    if (!tag) {
      return { valid: false, json: false };
    }

    return {
      valid: true,
      action,
      skillId: positional[1],
      tag,
      json,
    };
  }

  return { valid: false, json: false };
}
