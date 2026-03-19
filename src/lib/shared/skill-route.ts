export function buildSkillRoutePath(username: string | undefined, skillSlug: string): string {
  return username ? `@${username}/${skillSlug}` : skillSlug;
}
