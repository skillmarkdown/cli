#!/usr/bin/env node

import { runInitCommand } from "./commands/init";
import { runLoginCommand } from "./commands/login";
import { runLogoutCommand } from "./commands/logout";
import { runPublishCommand } from "./commands/publish";
import { runValidateCommand } from "./commands/validate";
import { ROOT_USAGE } from "./lib/shared/cli-text";

type CommandHandler = (args: string[]) => number | Promise<number>;

const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  init: runInitCommand,
  validate: runValidateCommand,
  login: runLoginCommand,
  logout: runLogoutCommand,
  publish: runPublishCommand,
};

async function main(): Promise<void> {
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
    process.exitCode = await handler(args.slice(1));
    return;
  }

  console.error(`skillmd: unknown command '${command}'`);
  console.error(ROOT_USAGE);
  process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`skillmd: ${message}`);
  process.exitCode = 1;
});
