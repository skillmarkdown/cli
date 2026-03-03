import { valid as isValidSemver } from "semver";

import { type ParsedUnpublishRequest, type UnpublishFlags } from "./types";

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
  const version = value.slice(separator + 1).trim();
  if (!skillId || !version || !SEMVER_PATTERN.test(version) || !isValidSemver(version)) {
    return null;
  }

  return { skillId, version };
}

export function parseUnpublishFlags(args: string[]): UnpublishFlags {
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

  if (positional.length !== 1) {
    return { valid: false, json: false };
  }

  return {
    valid: true,
    json,
    skillWithVersion: positional[0],
  };
}

export function parseUnpublishRequest(flags: UnpublishFlags): ParsedUnpublishRequest | null {
  if (!flags.valid || !flags.skillWithVersion) {
    return null;
  }

  const parsed = splitSkillAndVersion(flags.skillWithVersion);
  if (!parsed) {
    return null;
  }

  return {
    skillId: parsed.skillId,
    version: parsed.version,
    json: flags.json,
  };
}
