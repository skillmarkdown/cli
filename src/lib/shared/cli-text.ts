export const ROOT_USAGE =
  "Usage: skillmd <init|validate|login|logout|publish|search|view|history|use|update>";
export const INIT_USAGE = "Usage: skillmd init [--no-validate] [--template <minimal|verbose>]";
export const VALIDATE_USAGE = "Usage: skillmd validate [path] [--strict] [--parity]";
export const LOGIN_USAGE = "Usage: skillmd login [--status|--reauth]";
export const LOGOUT_USAGE = "Usage: skillmd logout";
export const PUBLISH_USAGE =
  "Usage: skillmd publish [path] --version <semver> [--channel <latest|beta>] [--visibility <public|private>] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--dry-run] [--json]";
export const SEARCH_USAGE =
  "Usage: skillmd search [query] [--limit <1-50>] [--cursor <token>] [--scope <public|private>] [--json]";
export const VIEW_USAGE = "Usage: skillmd view <skill-id|index> [--json]";
export const HISTORY_USAGE =
  "Usage: skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]";
export const USE_USAGE =
  "Usage: skillmd use <skill-id> [--version <semver> | --channel <latest|beta>] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--allow-yanked] [--json]";
export const UPDATE_USAGE =
  "Usage: skillmd update [skill-id ...] [--all] [--agent-target <skillmd|claude|gemini|custom:<slug>>] [--allow-yanked] [--json]";
