import { join } from "node:path";

const INSTALL_REGISTRY_HOST = "registry.skillmarkdown.com";

export function resolveRegistryHost(baseUrl: string): string {
  void baseUrl;
  return INSTALL_REGISTRY_HOST;
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
