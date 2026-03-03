import { type SkillsLockEntry, type UpdateIntentResolution } from "./types";

function asVersionSelector(value: string): UpdateIntentResolution {
  return {
    selector: {
      strategy: "version",
      value,
    },
  };
}

function asSpecSelector(value: string): UpdateIntentResolution {
  return {
    selector: {
      strategy: "spec",
      value,
    },
  };
}

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function resolveUpdateIntent(metadata: SkillsLockEntry | null): UpdateIntentResolution {
  const selectorSpec = metadata?.selectorSpec?.trim() || "latest";
  if (SEMVER_PATTERN.test(selectorSpec)) {
    return asVersionSelector(selectorSpec);
  }
  return asSpecSelector(selectorSpec);
}
