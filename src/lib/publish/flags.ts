import { PUBLISH_ACCESSES, type PublishFlags, type PublishAccess } from "./types";
import { normalizeAgentTarget } from "../shared/agent-target";
import { parseOptionValue } from "../shared/flag-parse";
import { isCanonicalSemver } from "../shared/semver";
import { parseStrictDistTag } from "../shared/tag-validation";

function resolveAccess(value: string): PublishAccess | null {
  return PUBLISH_ACCESSES.includes(value as PublishAccess) ? (value as PublishAccess) : null;
}

export function parsePublishFlags(args: string[]): PublishFlags {
  const invalid = (): PublishFlags => ({
    provenance: false,
    dryRun: false,
    json: false,
    valid: false,
  });
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

    const parsedVersion = parseOptionValue(args, index, "version");
    if (parsedVersion.matched) {
      if (!parsedVersion.value) {
        return invalid();
      }
      version = parsedVersion.value;
      index = parsedVersion.nextIndex;
      continue;
    }

    const parsedTag = parseOptionValue(args, index, "tag");
    if (parsedTag.matched) {
      const tagValue = parsedTag.value ? parseStrictDistTag(parsedTag.value) : null;
      if (!tagValue) {
        return invalid();
      }
      tag = tagValue;
      index = parsedTag.nextIndex;
      continue;
    }

    const parsedAccess = parseOptionValue(args, index, "access");
    if (parsedAccess.matched) {
      const resolved = resolveAccess(parsedAccess.value ?? "");
      if (!resolved) {
        return invalid();
      }
      access = resolved;
      index = parsedAccess.nextIndex;
      continue;
    }

    if (arg === "--provenance") {
      provenance = true;
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

    if (pathArg) {
      return invalid();
    }

    pathArg = arg;
  }

  if (!version || !isCanonicalSemver(version)) {
    return invalid();
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
