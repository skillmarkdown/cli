import { isCanonicalSemver, isValidSemverRange } from "./semver";

const DIST_TAG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function isValidDistTag(value: string): boolean {
  return DIST_TAG_PATTERN.test(value);
}

export function parseStrictDistTag(value: string): string | null {
  if (!isValidDistTag(value)) {
    return null;
  }
  if (isCanonicalSemver(value) || isValidSemverRange(value)) {
    return null;
  }
  return value;
}
