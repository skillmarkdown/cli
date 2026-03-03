import {
  type PublishChannel,
  PUBLISH_CHANNELS,
  type PublishFlags,
  type PublishVisibility,
  PUBLISH_VISIBILITIES,
} from "./types";
import { normalizeAgentTarget } from "../shared/agent-target";

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function resolveChannel(value: string): PublishChannel | null {
  return PUBLISH_CHANNELS.includes(value as PublishChannel) ? (value as PublishChannel) : null;
}

function resolveVisibility(value: string): PublishVisibility | null {
  return PUBLISH_VISIBILITIES.includes(value as PublishVisibility)
    ? (value as PublishVisibility)
    : null;
}

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

export function isPrereleaseVersion(value: string): boolean {
  const match = value.match(SEMVER_PATTERN);
  return Boolean(match && match[4]);
}

export function parsePublishFlags(args: string[]): PublishFlags {
  let pathArg: string | undefined;
  let version: string | undefined;
  let channel: PublishChannel | undefined;
  let visibility: PublishVisibility | undefined;
  let agentTarget: PublishFlags["agentTarget"];
  let dryRun = false;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--version") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { dryRun: false, json: false, valid: false };
      }
      version = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length);
      continue;
    }

    if (arg === "--channel") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { dryRun: false, json: false, valid: false };
      }

      const resolved = resolveChannel(parsed.value);
      if (!resolved) {
        return { dryRun: false, json: false, valid: false };
      }

      channel = resolved;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--channel=")) {
      const resolved = resolveChannel(arg.slice("--channel=".length));
      if (!resolved) {
        return { dryRun: false, json: false, valid: false };
      }

      channel = resolved;
      continue;
    }

    if (arg === "--visibility") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { dryRun: false, json: false, valid: false };
      }

      const resolved = resolveVisibility(parsed.value);
      if (!resolved) {
        return { dryRun: false, json: false, valid: false };
      }

      visibility = resolved;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--visibility=")) {
      const resolved = resolveVisibility(arg.slice("--visibility=".length));
      if (!resolved) {
        return { dryRun: false, json: false, valid: false };
      }

      visibility = resolved;
      continue;
    }

    if (arg === "--agent-target") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { dryRun: false, json: false, valid: false };
      }

      const parsedTarget = normalizeAgentTarget(parsed.value);
      if (!parsedTarget) {
        return { dryRun: false, json: false, valid: false };
      }

      agentTarget = parsedTarget;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--agent-target=")) {
      const parsedTarget = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsedTarget) {
        return { dryRun: false, json: false, valid: false };
      }

      agentTarget = parsedTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      return { dryRun: false, json: false, valid: false };
    }

    if (pathArg) {
      return { dryRun: false, json: false, valid: false };
    }

    pathArg = arg;
  }

  if (!version || !isValidSemver(version)) {
    return { dryRun: false, json: false, valid: false };
  }

  return {
    pathArg,
    version,
    channel,
    visibility,
    agentTarget,
    dryRun,
    json,
    valid: true,
  };
}
