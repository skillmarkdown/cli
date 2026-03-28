import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { resolveWriteAuth } from "../lib/auth/write-auth";
import {
  createAccountSupportRequest as defaultCreateAccountSupportRequest,
  deleteAccount as defaultDeleteAccount,
} from "../lib/account/client";
import { isAccountApiError } from "../lib/account/errors";
import { DELETE_CONFIRMATION, parseAccountFlags } from "../lib/account/flags";
import {
  type AccountDeleteResponse,
  type AccountEnvConfig,
  type AccountSupportResponse,
} from "../lib/account/types";
import { failWithUsage } from "../lib/shared/command-output";
import { getAuthRegistryEnvConfig } from "../lib/shared/env-config";
import { executeWriteCommand } from "../lib/shared/command-execution";
import { ACCOUNT_USAGE } from "../lib/shared/cli-text";

interface AccountCommandOptions {
  env?: NodeJS.ProcessEnv;
  getAuthConfig?: (env: NodeJS.ProcessEnv) => AccountEnvConfig;
  deleteAccount?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<AccountDeleteResponse>;
  createAccountSupportRequest?: (
    baseUrl: string,
    idToken: string,
    request: { subject: string; message: string },
    options?: { timeoutMs?: number },
  ) => Promise<AccountSupportResponse>;
  promptForDeleteConfirmation?: () => Promise<string>;
}

async function promptForDeleteConfirmation(): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      `account deletion requires --confirm ${DELETE_CONFIRMATION} when standard input is not interactive`,
    );
  }

  const rl = createInterface({ input, output });
  try {
    return (await rl.question(`Type ${DELETE_CONFIRMATION} to request account deletion: `)).trim();
  } finally {
    rl.close();
  }
}

export async function runAccountCommand(
  args: string[],
  options: AccountCommandOptions = {},
): Promise<number> {
  const parsed = parseAccountFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd account: unsupported argument(s)", ACCOUNT_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getAuthConfig ?? getAuthRegistryEnvConfig)(env);
    const resolveAccountWriteAuth = async () => {
      const auth = await resolveWriteAuth({
        command: "skillmd account",
        env,
        config,
      });
      return auth.ok
        ? { ok: true as const, idToken: auth.value.idToken }
        : { ok: false as const, message: auth.message };
    };

    if (parsed.action === "delete") {
      const confirmed =
        parsed.confirm ??
        (await (options.promptForDeleteConfirmation ?? promptForDeleteConfirmation)());
      if (confirmed !== DELETE_CONFIRMATION) {
        throw new Error(`confirmation must exactly match '${DELETE_CONFIRMATION}'`);
      }

      return executeWriteCommand<AccountDeleteResponse>({
        command: "skillmd account",
        json: parsed.json,
        resolveAuth: resolveAccountWriteAuth,
        run: (idToken) =>
          (options.deleteAccount ?? defaultDeleteAccount)(config.registryBaseUrl, idToken, {
            timeoutMs: config.requestTimeoutMs,
          }),
        printHuman: (result) => {
          console.log(`Account deletion requested for @${result.username}.`);
          console.log(`Status: ${result.status}`);
          console.log(`Deletion ID: ${result.deletionId}`);
          console.log(`UID: ${result.uid}`);
        },
        isApiError: isAccountApiError,
      });
    }

    return executeWriteCommand<AccountSupportResponse>({
      command: "skillmd account",
      json: parsed.json,
      resolveAuth: resolveAccountWriteAuth,
      run: (idToken) =>
        (options.createAccountSupportRequest ?? defaultCreateAccountSupportRequest)(
          config.registryBaseUrl,
          idToken,
          { subject: parsed.subject, message: parsed.message },
          { timeoutMs: config.requestTimeoutMs },
        ),
      printHuman: (result) => {
        console.log("Support request submitted.");
        console.log(`Status: ${result.status}`);
        console.log(`Request ID: ${result.requestId}`);
      },
      isApiError: isAccountApiError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd account: ${message}`);
    return 1;
  }
}
