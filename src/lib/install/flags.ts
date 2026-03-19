import { normalizeAgentTarget } from "../shared/agent-target";
import { parseOptionValue } from "../shared/flag-parse";
import { type InstallFlags } from "./types";

export function parseInstallFlags(args: string[]): InstallFlags {
  const invalid = (): InstallFlags => ({
    prune: false,
    global: false,
    json: false,
    valid: false,
  });
  let prune = false;
  let global = false;
  let json = false;
  let agentTarget: InstallFlags["agentTarget"];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--prune") {
      prune = true;
      continue;
    }

    if (arg === "-g" || arg === "--global") {
      global = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
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

    return invalid();
  }

  return {
    prune,
    global,
    json,
    agentTarget,
    valid: true,
  };
}
