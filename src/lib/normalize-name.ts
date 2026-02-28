const MAX_SKILL_NAME_LENGTH = 64;

export function normalizeSkillName(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length === 0) {
    throw new Error(
      "skill name is empty after normalization; use letters/numbers and optional hyphens",
    );
  }

  if (normalized.length > MAX_SKILL_NAME_LENGTH) {
    throw new Error(
      `skill name must be at most ${MAX_SKILL_NAME_LENGTH} characters`,
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(
      "skill name must use lowercase letters, numbers, and single hyphens only",
    );
  }

  return normalized;
}

export function getMaxSkillNameLength(): number {
  return MAX_SKILL_NAME_LENGTH;
}
