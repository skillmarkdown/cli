export const ROOT_USAGE =
  "Usage: skillmd [--auth-token <token>] [--version|-v] <init|validate|login|logout|publish|search|view|history|install|list|remove|use|update|tag|deprecate|unpublish|whoami|org|token>";
export const INIT_USAGE = "Usage: skillmd init [--no-validate] [--template <minimal|verbose>]";
export const INSTALL_USAGE =
  "Usage: skillmd install [-g|--global] [--prune] [--agent-target <skillmd|openai|claude|gemini|meta|mistral|deepseek|perplexity|custom:<slug>>] [--json]";
export const LIST_USAGE =
  "Usage: skillmd list [-g|--global] [--agent-target <skillmd|openai|claude|gemini|meta|mistral|deepseek|perplexity|custom:<slug>>] [--json]";
export const REMOVE_USAGE =
  "Usage: skillmd remove <skill-id> [-g|--global] [--agent-target <skillmd|openai|claude|gemini|meta|mistral|deepseek|perplexity|custom:<slug>>] [--json]";
export const VALIDATE_USAGE = "Usage: skillmd validate [path] [--strict] [--parity]";
export const LOGIN_USAGE = "Usage: skillmd login [--status|--reauth]";
export const LOGOUT_USAGE = "Usage: skillmd logout";
export const PUBLISH_USAGE =
  "Usage: skillmd publish [path] --version <semver> [--tag <dist-tag>] [--access <public|private>] [--provenance] [--owner <owner>] [--agent-target <skillmd|openai|claude|gemini|meta|mistral|deepseek|perplexity|custom:<slug>>] [--dry-run] [--json]";
export const SEARCH_USAGE =
  "Usage: skillmd search [query] [--limit <1-50>] [--cursor <token>] [--scope <public|private>] [--json]";
export const VIEW_USAGE = "Usage: skillmd view <skill-id|index> [--json]";
export const HISTORY_USAGE =
  "Usage: skillmd history <skill-id> [--limit <1-50>] [--cursor <token>] [--json]";
export const USE_USAGE =
  "Usage: skillmd use <skill-id> [-g|--global] [--version <semver> | --spec <tag|version|range>] [--agent-target <skillmd|openai|claude|gemini|meta|mistral|deepseek|perplexity|custom:<slug>>] [--save] [--json]";
export const UPDATE_USAGE =
  "Usage: skillmd update [skill-id ...] [-g|--global] [--all] [--agent-target <skillmd|openai|claude|gemini|meta|mistral|deepseek|perplexity|custom:<slug>>] [--json]";
export const TAG_USAGE =
  "Usage: skillmd tag <ls|add|rm> ... [--json]\n" +
  "  skillmd tag ls <skill-id> [--json]\n" +
  "  skillmd tag add <skill-id>@<version> <tag> [--json]\n" +
  "  skillmd tag rm <skill-id> <tag> [--json]";
export const DEPRECATE_USAGE =
  'Usage: skillmd deprecate <skill-id>@<version|range> --message "<text>" [--json]';
export const UNPUBLISH_USAGE = "Usage: skillmd unpublish <skill-id>@<version> [--json]";
export const WHOAMI_USAGE = "Usage: skillmd whoami [--json]";
export const ORG_USAGE =
  "Usage: skillmd org <ls|create|members|team|skills|tokens> ... [--json]\n" +
  "  skillmd org ls [--json]\n" +
  "  skillmd org create <org> [--json]\n" +
  "  skillmd org members ls <org> [--json]\n" +
  "  skillmd org members add <org> <username> [--role <owner|admin|member>] [--json]\n" +
  "  skillmd org members rm <org> <username> [--json]\n" +
  "  skillmd org team ls <org> [--json]\n" +
  "  skillmd org team add <org> <team-slug> --name <display-name> [--json]\n" +
  "  skillmd org team members ls <org> <team-slug> [--json]\n" +
  "  skillmd org team members add <org> <team-slug> <username> [--json]\n" +
  "  skillmd org team members rm <org> <team-slug> <username> [--json]\n" +
  "  skillmd org skills ls <org> [--json]\n" +
  "  skillmd org skills team set <org> <skill-slug> <team-slug> [--json]\n" +
  "  skillmd org skills team clear <org> <skill-slug> [--json]\n" +
  "  skillmd org tokens ls <org> [--json]\n" +
  "  skillmd org tokens add <org> <name> [--scope <publish|admin>] [--days <1-365>] [--json]\n" +
  "  skillmd org tokens rm <org> <token-id> [--json]";
export const TOKEN_USAGE =
  "Usage: skillmd token <ls|add|rm> ... [--json]\n" +
  "  skillmd token ls [--json]\n" +
  "  skillmd token add <name> [--scope <read|publish|admin>] [--days <1-365>] [--json]\n" +
  "  skillmd token rm <token-id> [--json]";
