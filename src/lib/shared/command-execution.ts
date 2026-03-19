import {
  printCommandResult,
  printJsonApiError,
  printJsonError,
  printLoginRequired,
} from "./command-output";
import { formatCliApiErrorWithHint, SKILLMARKDOWN_WEBSITE_URL } from "./authz-error-hints";
import { type CliApiError } from "./api-errors";

interface ExecuteReadCommandOptions<TResult, TError extends CliApiError = CliApiError> {
  command: string;
  json: boolean;
  resolveIdToken: () => Promise<string | null>;
  run: (idToken: string) => Promise<TResult>;
  printHuman: (result: TResult) => void;
  isApiError: (error: unknown) => error is TError;
}

interface ExecuteWriteCommandOptions<TResult, TError extends CliApiError = CliApiError> {
  command: string;
  json: boolean;
  resolveAuth: () => Promise<{ ok: true; idToken: string } | { ok: false; message: string }>;
  run: (idToken: string) => Promise<TResult>;
  printHuman: (result: TResult) => void;
  isApiError: (error: unknown) => error is TError;
}

function printUnknownCommandError(command: string, error: unknown): number {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`${command}: ${message}`);
  return 1;
}

export async function executeReadCommand<TResult, TError extends CliApiError = CliApiError>(
  options: ExecuteReadCommandOptions<TResult, TError>,
): Promise<number> {
  try {
    const idToken = await options.resolveIdToken();
    if (!idToken) {
      if (options.json) {
        printJsonError("auth", "not logged in", {
          hint: `Run 'skillmd login' first at ${SKILLMARKDOWN_WEBSITE_URL}.`,
        });
        return 1;
      }
      printLoginRequired(options.command);
      return 1;
    }

    const result = await options.run(idToken);
    printCommandResult(options.json, result, () => options.printHuman(result));
    return 0;
  } catch (error) {
    if (options.isApiError(error)) {
      if (options.json) {
        printJsonApiError(error);
        return 1;
      }
      console.error(formatCliApiErrorWithHint(options.command, error));
      return 1;
    }
    if (options.json) {
      const message = error instanceof Error ? error.message : "Unknown error";
      printJsonError("internal", message);
      return 1;
    }
    return printUnknownCommandError(options.command, error);
  }
}

export async function executeWriteCommand<TResult, TError extends CliApiError = CliApiError>(
  options: ExecuteWriteCommandOptions<TResult, TError>,
): Promise<number> {
  try {
    const auth = await options.resolveAuth();
    if (!auth.ok) {
      if (options.json) {
        const prefix = `${options.command}: `;
        const message = auth.message.startsWith(prefix)
          ? auth.message.slice(prefix.length)
          : auth.message;
        printJsonError("auth", message);
        return 1;
      }
      console.error(auth.message);
      return 1;
    }

    const result = await options.run(auth.idToken);
    printCommandResult(options.json, result, () => options.printHuman(result));
    return 0;
  } catch (error) {
    if (options.isApiError(error)) {
      if (options.json) {
        printJsonApiError(error);
        return 1;
      }
      console.error(formatCliApiErrorWithHint(options.command, error));
      return 1;
    }
    if (options.json) {
      const message = error instanceof Error ? error.message : "Unknown error";
      printJsonError("internal", message);
      return 1;
    }
    return printUnknownCommandError(options.command, error);
  }
}
