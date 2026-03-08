import { type UpdateFlags } from "./types";
import { normalizeAgentTarget } from "../shared/agent-target";
import { parseOptionValue } from "../shared/flag-parse";

export function parseUpdateFlags(args: string[]): UpdateFlags {
  const invalid = (): UpdateFlags => ({
    all: false,
    global: false,
    json: false,
    skillIds: [],
    valid: false,
  });
  const skillIds: string[] = [];
  let all = false;
  let json = false;
  let global = false;
  let agentTarget: UpdateFlags["agentTarget"];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "-g" || arg === "--global") {
      global = true;
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

    skillIds.push(arg);
  }

  if (all && skillIds.length > 0) {
    return invalid();
  }

  return {
    all,
    json,
    global,
    skillIds,
    agentTarget,
    valid: true,
  };
}
