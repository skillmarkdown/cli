export const ROOT_USAGE =
  "Usage: skillmd <init|validate|login|logout|publish|search|view|history|install|use|update|tag|deprecate|unpublish>";
export const INIT_USAGE = "Usage: skillmd init [--no-validate] [--template <minimal|verbose>]";
export const INSTALL_USAGE =
  "Usage: skillmd install [--prune] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--json]";
export const VALIDATE_USAGE = "Usage: skillmd validate [path] [--strict] [--parity]";
export const LOGIN_USAGE = "Usage: skillmd login [--status|--reauth]";
export const LOGOUT_USAGE = "Usage: skillmd logout";
export const PUBLISH_USAGE =
  "Usage: skillmd publish [path] --version <semver> [--tag <dist-tag>] [--access <public|private>] [--provenance] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--dry-run] [--json]";
export const SEARCH_USAGE =
  "Usage: skillmd search [query] [--limit <1-50>] [--cursor <token>] [--scope <public|private>] [--json]";
export const VIEW_USAGE = "Usage: skillmd view <skill-id|index> [--json]";
export const HISTORY_USAGE =
  "Usage: skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]";
export const USE_USAGE =
  "Usage: skillmd use <skill-id> [--version <semver> | --spec <tag|version|range>] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--json]";
export const UPDATE_USAGE =
  "Usage: skillmd update [skill-id ...] [--all] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--json]";
export const TAG_USAGE =
  "Usage: skillmd tag <ls|add|rm> ... [--json]\n" +
  "  skillmd tag ls <skill-id> [--json]\n" +
  "  skillmd tag add <skill-id>@<version> <tag> [--json]\n" +
  "  skillmd tag rm <skill-id> <tag> [--json]";
export const DEPRECATE_USAGE =
  'Usage: skillmd deprecate <skill-id>@<version|range> --message "<text>" [--json]';
export const UNPUBLISH_USAGE = "Usage: skillmd unpublish <skill-id>@<version> [--json]";
