#!/usr/bin/env node

import { runInitCommand } from "./commands/init";
import { runValidateCommand } from "./commands/validate";
import { ROOT_USAGE } from "./lib/cli-text";

const COMMAND_HANDLERS: Record<string, (args: string[]) => number> = {
  init: runInitCommand,
  validate: runValidateCommand,
};

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (args.length === 0) {
    console.error("skillmd: no command provided");
    console.error(ROOT_USAGE);
    process.exitCode = 1;
    return;
  }

  const handler = COMMAND_HANDLERS[command];
  if (handler) {
    process.exitCode = handler(args.slice(1));
    return;
  }

  console.error(`skillmd: unknown command '${command}'`);
  console.error(ROOT_USAGE);
  process.exitCode = 1;
}

main();
