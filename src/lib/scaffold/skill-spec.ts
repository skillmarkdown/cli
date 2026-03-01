export const MAX_SKILL_NAME_LENGTH = 64;

export const INIT_TEMPLATE_IDS = ["minimal", "verbose"] as const;
export type InitTemplateId = (typeof INIT_TEMPLATE_IDS)[number];

export const SCAFFOLD_DIRECTORIES = ["scripts", "references", "assets"] as const;

export const STRICT_REQUIRED_FILES = [
  ".gitignore",
  ...SCAFFOLD_DIRECTORIES.map((directory) => `${directory}/.gitkeep`),
];

export const STRICT_SECTION_TITLES = [
  "Scope",
  "When to use",
  "Inputs",
  "Outputs",
  "Steps / Procedure",
  "Examples",
  "Limitations / Failure modes",
  "Security / Tool access",
] as const;

export const STRICT_SECTION_HEADINGS = STRICT_SECTION_TITLES.map((title) => `## ${title}`);
