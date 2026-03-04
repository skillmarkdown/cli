#!/usr/bin/env node

import { runInitCommand } from "./commands/init";
import { runInstallCommand } from "./commands/install";
import { runHistoryCommand } from "./commands/history";
import { runLoginCommand } from "./commands/login";
import { runLogoutCommand } from "./commands/logout";
import { runPublishCommand } from "./commands/publish";
import { runSearchCommand } from "./commands/search";
import { runTagCommand } from "./commands/tag";
import { runTeamCommand } from "./commands/team";
import { runDeprecateCommand } from "./commands/deprecate";
import { runUnpublishCommand } from "./commands/unpublish";
import { runTokenCommand } from "./commands/token";
import { runUpdateCommand } from "./commands/update";
import { runUseCommand } from "./commands/use";
import { runValidateCommand } from "./commands/validate";
import { runViewCommand } from "./commands/view";
import { runWhoamiCommand } from "./commands/whoami";
import { ROOT_USAGE } from "./lib/shared/cli-text";
import { AUTH_TOKEN_ENV_VAR } from "./lib/auth/api-token";

type CommandHandler = (args: string[]) => number | Promise<number>;

const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  init: runInitCommand,
  install: runInstallCommand,
  history: runHistoryCommand,
  validate: runValidateCommand,
  login: runLoginCommand,
  logout: runLogoutCommand,
  publish: runPublishCommand,
  search: runSearchCommand,
  view: runViewCommand,
  use: runUseCommand,
  update: runUpdateCommand,
  tag: runTagCommand,
  team: runTeamCommand,
  deprecate: runDeprecateCommand,
  unpublish: runUnpublishCommand,
  whoami: runWhoamiCommand,
  token: runTokenCommand,
};

interface ParsedGlobalFlags {
  args: string[];
  authToken: string | null;
  error?: string;
}

declare const __SKILLMD_CLI_VERSION__: string;

function isRootVersionRequest(args: string[]): boolean {
  if (args.length === 0) {
    return false;
  }

  return args.every((arg) => arg === "--version" || arg === "-v");
}

function readCliVersion(): string {
  return __SKILLMD_CLI_VERSION__;
}

function parseGlobalFlags(rawArgs: string[]): ParsedGlobalFlags {
  const args: string[] = [];
  let authToken: string | null = null;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];
    if (current === "--auth-token") {
      const value = rawArgs[index + 1];
      if (!value) {
        return { args: [], authToken: null, error: "missing value for --auth-token" };
      }
      authToken = value;
      index += 1;
      continue;
    }

    if (current.startsWith("--auth-token=")) {
      const value = current.slice("--auth-token=".length).trim();
      if (!value) {
        return { args: [], authToken: null, error: "missing value for --auth-token" };
      }
      authToken = value;
      continue;
    }

    args.push(current);
  }

  return { args, authToken };
}

async function main(): Promise<void> {
  const parsedGlobals = parseGlobalFlags(process.argv.slice(2));
  if (parsedGlobals.error) {
    console.error(`skillmd: ${parsedGlobals.error}`);
    console.error(ROOT_USAGE);
    process.exitCode = 1;
    return;
  }

  if (parsedGlobals.authToken) {
    process.env[AUTH_TOKEN_ENV_VAR] = parsedGlobals.authToken;
  }

  const args = parsedGlobals.args;
  if (isRootVersionRequest(args)) {
    console.log(readCliVersion());
    process.exitCode = 0;
    return;
  }

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
