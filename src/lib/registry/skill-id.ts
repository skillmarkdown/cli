export interface ParsedSkillId {
  username: string;
  skillSlug: string;
  skillId: string;
}

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const SKILL_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function parseSkillId(input: string): ParsedSkillId {
  const trimmed = input.trim();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    throw new Error("skill id must be in the form @owner/skill or owner/skill");
  }

  const ownerRaw = trimmed.slice(0, slashIndex);
  const skillRaw = trimmed.slice(slashIndex + 1);

  const username = ownerRaw.toLowerCase().replace(/^@+/, "");
  const skillSlug = skillRaw.toLowerCase();

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("owner in skill id must be a valid slug");
  }

  if (!SKILL_SLUG_PATTERN.test(skillSlug)) {
    throw new Error("skill in skill id must be a valid slug");
  }

  return {
    username,
    skillSlug,
    skillId: `@${username}/${skillSlug}`,
  };
}
