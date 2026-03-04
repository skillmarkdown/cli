import { valid as parseSemver, validRange as parseSemverRange } from "semver";

const CANONICAL_SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function isCanonicalSemver(value: string): boolean {
  return CANONICAL_SEMVER_PATTERN.test(value) && Boolean(parseSemver(value));
}

export function isValidSemverRange(value: string): boolean {
  return Boolean(parseSemverRange(value));
}
