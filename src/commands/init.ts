import { scaffoldSkillInDirectory } from "../lib/scaffold";

export function runInitCommand(args: string[], cwd = process.cwd()): number {
  if (args.length > 0) {
    console.error("skillmd init: this command does not accept arguments");
    console.error("Usage: skillmd init");
    return 1;
  }

  try {
    const result = scaffoldSkillInDirectory(cwd);
    console.log(`Initialized skill '${result.skillName}' in ${cwd}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd init: ${message}`);
    return 1;
  }
}
