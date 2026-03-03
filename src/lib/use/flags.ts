import { type PublishChannel, PUBLISH_CHANNELS } from "../publish/types";
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

function parseChannel(value: string): PublishChannel | null {
  return PUBLISH_CHANNELS.includes(value as PublishChannel) ? (value as PublishChannel) : null;
}

function isValidSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}

export function parseUseFlags(args: string[]): UseFlags {
  let skillId: string | undefined;
  let version: string | undefined;
  let channel: PublishChannel | undefined;
  let agentTarget: UseFlags["agentTarget"];
  let allowYanked = false;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--allow-yanked") {
      allowYanked = true;
      continue;
    }

    if (arg === "--version") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value || !isValidSemver(parsed.value)) {
        return { allowYanked: false, json: false, valid: false };
      }

      version = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--version=")) {
      const parsedVersion = arg.slice("--version=".length);
      if (!isValidSemver(parsedVersion)) {
        return { allowYanked: false, json: false, valid: false };
      }

      version = parsedVersion;
      continue;
    }

    if (arg === "--channel") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { allowYanked: false, json: false, valid: false };
      }

      const parsedChannel = parseChannel(parsed.value);
      if (!parsedChannel) {
        return { allowYanked: false, json: false, valid: false };
      }

      channel = parsedChannel;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--channel=")) {
      const parsedChannel = parseChannel(arg.slice("--channel=".length));
      if (!parsedChannel) {
        return { allowYanked: false, json: false, valid: false };
      }

      channel = parsedChannel;
      continue;
    }

    if (arg === "--agent-target") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { allowYanked: false, json: false, valid: false };
      }
      const parsedTarget = normalizeAgentTarget(parsed.value);
      if (!parsedTarget) {
        return { allowYanked: false, json: false, valid: false };
      }

      agentTarget = parsedTarget;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--agent-target=")) {
      const parsedTarget = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsedTarget) {
        return { allowYanked: false, json: false, valid: false };
      }

      agentTarget = parsedTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      return { allowYanked: false, json: false, valid: false };
    }

    if (skillId) {
      return { allowYanked: false, json: false, valid: false };
    }

    skillId = arg;
  }

  if (!skillId || (version && channel)) {
    return { allowYanked: false, json: false, valid: false };
  }

  return {
    skillId,
    version,
    channel,
    agentTarget,
    allowYanked,
    json,
    valid: true,
  };
}
