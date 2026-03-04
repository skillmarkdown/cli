import { type DeprecateFlags, type ParsedDeprecateRequest } from "./types";
import { parseOptionValue } from "../shared/flag-parse";
import { isCanonicalSemver, isValidSemverRange } from "../shared/semver";
import { splitSkillAndSelector as splitSkillSelector } from "../shared/skill-selector";

function splitDeprecationTarget(value: string): { skillId: string; range: string } | null {
  const split = splitSkillSelector(value);
  if (!split) {
    return null;
  }
  return { skillId: split.skillId, range: split.selector };
}

function isValidDeprecationSelector(value: string): boolean {
  if (isCanonicalSemver(value)) {
    return true;
  }

  return isValidSemverRange(value);
}

export function parseDeprecateFlags(args: string[]): DeprecateFlags {
  const invalid = (): DeprecateFlags => ({ valid: false, json: false });
  let json = false;
  let message: string | undefined;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    const messageOption = parseOptionValue(args, index, "message");
    if (messageOption.matched) {
      if (!messageOption.value) {
        return invalid();
      }
      message = messageOption.value.trim();
      index = messageOption.nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      return invalid();
    }

    positional.push(arg);
  }

  if (positional.length !== 1 || !message) {
    return invalid();
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

  const parsed = splitDeprecationTarget(flags.skillWithSelector);
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
