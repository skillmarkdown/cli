import { type PublishChannel, PUBLISH_CHANNELS, type PublishFlags } from "./types";

const OWNER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function resolveChannel(value: string): PublishChannel | null {
  return PUBLISH_CHANNELS.includes(value as PublishChannel) ? (value as PublishChannel) : null;
}

function parseValueArg(args: string[], index: number): { value?: string; nextIndex: number } {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    return { nextIndex: index };
  }

  return { value, nextIndex: index + 1 };
}

function isValidOwnerSlug(value: string): boolean {
  return value.length > 0 && value.length <= 64 && OWNER_SLUG_PATTERN.test(value);
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
  let owner: string | undefined;
  let version: string | undefined;
  let channel: PublishChannel | undefined;
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

    if (arg === "--owner") {
      const parsed = parseValueArg(args, index);
      if (!parsed.value) {
        return { dryRun: false, json: false, valid: false };
      }
      owner = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--owner=")) {
      owner = arg.slice("--owner=".length);
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

    if (arg.startsWith("-")) {
      return { dryRun: false, json: false, valid: false };
    }

    if (pathArg) {
      return { dryRun: false, json: false, valid: false };
    }

    pathArg = arg;
  }

  if (!owner || !version || !isValidOwnerSlug(owner) || !isValidSemver(version)) {
    return { dryRun: false, json: false, valid: false };
  }

  return {
    pathArg,
    owner,
    version,
    channel,
    dryRun,
    json,
    valid: true,
  };
}
