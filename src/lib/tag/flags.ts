import { type ParsedTagFlags } from "./types";
import { isCanonicalSemver } from "../shared/semver";
import { splitSkillAndSelector } from "../shared/skill-selector";
import { parseStrictDistTag } from "../shared/tag-validation";
import { splitJsonFlag } from "../shared/flag-parse";

function splitSkillAndVersion(value: string): { skillId: string; version: string } | null {
  const split = splitSkillAndSelector(value);
  if (!split || !isCanonicalSemver(split.selector)) {
    return null;
  }
  return { skillId: split.skillId, version: split.selector };
}

export function parseTagFlags(args: string[]): ParsedTagFlags {
  if (args.length === 0) {
    return { valid: false, json: false };
  }

  const parsedArgs = splitJsonFlag(args);
  if (!parsedArgs) {
    return { valid: false, json: false };
  }
  const { json, positional } = parsedArgs;

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
    const tag = parseStrictDistTag(positional[2]);
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

    const tag = parseStrictDistTag(positional[2]);
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
