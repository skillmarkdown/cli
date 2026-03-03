import { normalizeAgentTarget } from "../shared/agent-target";
import { type InstallFlags } from "./types";

export function parseInstallFlags(args: string[]): InstallFlags {
  let prune = false;
  let json = false;
  let agentTarget: InstallFlags["agentTarget"];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--prune") {
      prune = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--agent-target") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { prune: false, json: false, valid: false };
      }
      const parsedTarget = normalizeAgentTarget(value);
      if (!parsedTarget) {
        return { prune: false, json: false, valid: false };
      }
      agentTarget = parsedTarget;
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent-target=")) {
      const parsedTarget = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsedTarget) {
        return { prune: false, json: false, valid: false };
      }
      agentTarget = parsedTarget;
      continue;
    }

    return { prune: false, json: false, valid: false };
  }

  return {
    prune,
    json,
    agentTarget,
    valid: true,
  };
}
