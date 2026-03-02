import { join } from "node:path";

export function resolveRegistryHost(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return parsed.host.toLowerCase();
}

export function resolveInstalledSkillPath(
  cwd: string,
  registryBaseUrl: string,
  ownerSlug: string,
  skillSlug: string,
): string {
  return join(cwd, ".agent", "skills", resolveRegistryHost(registryBaseUrl), ownerSlug, skillSlug);
}

export function resolveInstallTempRoot(cwd: string): string {
  return join(cwd, ".agent", ".tmp");
}
