import { normalizeAgentTarget } from "../shared/agent-target";
import { type UseFlags } from "./types";

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseValueArg(args: string[], index: number): { value?: string; nextIndex: number } {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    return { nextIndex: index };
  }

  return { value, nextIndex: index + 1 };
}

function isValidSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}

export function parseUseFlags(args: string[]): UseFlags {
  let skillId: string | undefined;
  let version: string | undefined;
  let spec: string | undefined;
  let agentTarget: UseFlags["agentTarget"];
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--version") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value || !isValidSemver(parsed.value)) {
        return { json: false, valid: false };
      }

      version = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--version=")) {
      const parsedVersion = arg.slice("--version=".length);
      if (!isValidSemver(parsedVersion)) {
        return { json: false, valid: false };
      }

      version = parsedVersion;
      continue;
    }

    if (arg === "--spec") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { json: false, valid: false };
      }

      spec = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--spec=")) {
      const parsedSpec = arg.slice("--spec=".length);
      if (!parsedSpec) {
        return { json: false, valid: false };
      }
      spec = parsedSpec;
      continue;
    }

    if (arg === "--agent-target") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { json: false, valid: false };
      }
      const parsedTarget = normalizeAgentTarget(parsed.value);
      if (!parsedTarget) {
        return { json: false, valid: false };
      }

      agentTarget = parsedTarget;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--agent-target=")) {
      const parsedTarget = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsedTarget) {
        return { json: false, valid: false };
      }

      agentTarget = parsedTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      return { json: false, valid: false };
    }

    if (skillId) {
      return { json: false, valid: false };
    }

    skillId = arg;
  }

  if (!skillId || (version && spec)) {
    return { json: false, valid: false };
  }

  return {
    skillId,
    version,
    spec,
    agentTarget,
    json,
    valid: true,
  };
}
