#!/usr/bin/env node

import { runInitCommand } from "./commands/init";
import { runValidateCommand } from "./commands/validate";

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("skillmd: no command provided");
    console.error("Usage: skillmd <init|validate>");
    process.exitCode = 1;
    return;
  }

  if (args[0] === "init") {
    process.exitCode = runInitCommand(args.slice(1));
    return;
  }

  if (args[0] === "validate") {
    process.exitCode = runValidateCommand(args.slice(1));
    return;
  }

  console.error(`skillmd: unknown command '${args[0]}'`);
  console.error("Usage: skillmd <init|validate>");
  process.exitCode = 1;
}

main();
