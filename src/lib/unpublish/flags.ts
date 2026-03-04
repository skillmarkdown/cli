import { type ParsedUnpublishRequest, type UnpublishFlags } from "./types";
import { isCanonicalSemver } from "../shared/semver";
import { splitSkillAndSelector } from "../shared/skill-selector";

function splitSkillAndVersion(value: string): { skillId: string; version: string } | null {
  const split = splitSkillAndSelector(value);
  if (!split || !isCanonicalSemver(split.selector)) {
    return null;
  }
  return { skillId: split.skillId, version: split.selector };
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
