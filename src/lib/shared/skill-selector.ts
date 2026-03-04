export function splitSkillAndSelector(value: string): { skillId: string; selector: string } | null {
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  const skillId = value.slice(0, separator).trim();
  const selector = value.slice(separator + 1).trim();
  return skillId && selector ? { skillId, selector } : null;
}
