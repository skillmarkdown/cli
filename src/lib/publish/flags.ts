import { PUBLISH_ACCESSES, type PublishFlags, type PublishAccess } from "./types";
import { normalizeAgentTarget } from "../shared/agent-target";

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const TAG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function resolveAccess(value: string): PublishAccess | null {
  return PUBLISH_ACCESSES.includes(value as PublishAccess) ? (value as PublishAccess) : null;
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

function isValidTag(value: string): boolean {
  return TAG_PATTERN.test(value);
}

function invalidFlags(): PublishFlags {
  return {
    provenance: false,
    dryRun: false,
    json: false,
    valid: false,
  };
}

export function parsePublishFlags(args: string[]): PublishFlags {
  let pathArg: string | undefined;
  let version: string | undefined;
  let tag: string | undefined;
  let access: PublishAccess | undefined;
  let provenance = false;
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
        return invalidFlags();
      }
      version = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length);
      continue;
    }

    if (arg === "--tag") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return invalidFlags();
      }

      if (!isValidTag(parsed.value)) {
        return invalidFlags();
      }

      tag = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--tag=")) {
      const parsedTag = arg.slice("--tag=".length);
      if (!isValidTag(parsedTag)) {
        return invalidFlags();
      }

      tag = parsedTag;
      continue;
    }

    if (arg === "--access") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return invalidFlags();
      }

      const resolved = resolveAccess(parsed.value);
      if (!resolved) {
        return invalidFlags();
      }

      access = resolved;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--access=")) {
      const resolved = resolveAccess(arg.slice("--access=".length));
      if (!resolved) {
        return invalidFlags();
      }

      access = resolved;
      continue;
    }

    if (arg === "--provenance") {
      provenance = true;
      continue;
    }

    if (arg === "--agent-target") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return invalidFlags();
      }

      const parsedTarget = normalizeAgentTarget(parsed.value);
      if (!parsedTarget) {
        return invalidFlags();
      }

      agentTarget = parsedTarget;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--agent-target=")) {
      const parsedTarget = normalizeAgentTarget(arg.slice("--agent-target=".length));
      if (!parsedTarget) {
        return invalidFlags();
      }

      agentTarget = parsedTarget;
      continue;
    }

    if (arg.startsWith("-")) {
      return invalidFlags();
    }

    if (pathArg) {
      return invalidFlags();
    }

    pathArg = arg;
  }

  if (!version || !isValidSemver(version)) {
    return invalidFlags();
  }

  return {
    pathArg,
    version,
    tag,
    access,
    provenance,
    agentTarget,
    dryRun,
    json,
    valid: true,
  };
}
