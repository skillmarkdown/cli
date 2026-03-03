import { type UpdateFlags } from "./types";
import { normalizeAgentTarget } from "../shared/agent-target";

export function parseUpdateFlags(args: string[]): UpdateFlags {
  const skillIds: string[] = [];
  let all = false;
  let allowYanked = false;
  let json = false;
  let agentTarget: UpdateFlags["agentTarget"];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--allow-yanked") {
      allowYanked = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--agent-target") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return {
          all: false,
          allowYanked: false,
          json: false,
          skillIds: [],
          valid: false,
        };
      }
      const parsedTarget = normalizeAgentTarget(value);
      if (!parsedTarget) {
        return {
          all: false,
          allowYanked: false,
          json: false,
          skillIds: [],
          valid: false,
        };
      }
      agentTarget = parsedTarget;
      index += 1;
      continue;
    }

    if (arg.startsWith("--agent-target=")) {
      const parsedTarget = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsedTarget) {
        return {
          all: false,
          allowYanked: false,
          json: false,
          skillIds: [],
          valid: false,
        };
      }
      agentTarget = parsedTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      return {
        all: false,
        allowYanked: false,
        json: false,
        skillIds: [],
        valid: false,
      };
    }

    skillIds.push(arg);
  }

  if (all && skillIds.length > 0) {
    return {
      all: false,
      allowYanked: false,
      json: false,
      skillIds: [],
      valid: false,
    };
  }

  return {
    all,
    allowYanked,
    json,
    skillIds,
    agentTarget,
    valid: true,
  };
}
