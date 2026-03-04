import { normalizeAgentTarget } from "../shared/agent-target";
import { parseOptionValue } from "../shared/flag-parse";
import { isCanonicalSemver } from "../shared/semver";
import { type UseFlags } from "./types";

export function parseUseFlags(args: string[]): UseFlags {
  const invalid = (): UseFlags => ({ json: false, valid: false });
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

    const parsedVersion = parseOptionValue(args, index, "version");
    if (parsedVersion.matched) {
      if (!parsedVersion.value || !isCanonicalSemver(parsedVersion.value)) {
        return invalid();
      }
      version = parsedVersion.value;
      index = parsedVersion.nextIndex;
      continue;
    }

    const parsedSpec = parseOptionValue(args, index, "spec");
    if (parsedSpec.matched) {
      if (!parsedSpec.value) {
        return invalid();
      }
      spec = parsedSpec.value;
      index = parsedSpec.nextIndex;
      continue;
    }

    const parsedTargetValue = parseOptionValue(args, index, "agent-target");
    if (parsedTargetValue.matched) {
      const parsedTarget = normalizeAgentTarget(parsedTargetValue.value ?? "");
      if (!parsedTarget) {
        return invalid();
      }
      agentTarget = parsedTarget;
      index = parsedTargetValue.nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      return invalid();
    }

    if (skillId) {
      return invalid();
    }

    skillId = arg;
  }

  if (!skillId || (version && spec)) {
    return invalid();
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
