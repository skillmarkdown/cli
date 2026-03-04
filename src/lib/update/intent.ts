import { type SkillsLockEntry, type UpdateIntentResolution } from "./types";
import { isCanonicalSemver } from "../shared/semver";

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

export function resolveUpdateIntent(metadata: SkillsLockEntry | null): UpdateIntentResolution {
  const selectorSpec = metadata?.selectorSpec?.trim() || "latest";
  if (isCanonicalSemver(selectorSpec)) {
    return asVersionSelector(selectorSpec);
  }
  return asSpecSelector(selectorSpec);
}
