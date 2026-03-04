import { exchangeRefreshTokenForIdToken, type FirebaseIdTokenSession } from "../lib/auth/id-token";
import { resolveConfiguredAuthToken } from "../lib/auth/api-token";
import { readAuthSession, type AuthSession } from "../lib/auth/session";
import { failWithUsage } from "../lib/shared/command-output";
import { TOKEN_USAGE } from "../lib/shared/cli-text";
import { getAuthRegistryEnvConfig } from "../lib/shared/env-config";
import {
  createToken as defaultCreateToken,
  listTokens as defaultListTokens,
  revokeToken as defaultRevokeToken,
} from "../lib/token/client";
import { isTokenApiError } from "../lib/token/errors";
import { parseTokenFlags } from "../lib/token/flags";
import {
  type CreatedTokenResponse,
  type ListTokensResponse,
  type RevokeTokenResponse,
  type TokenEnvConfig,
  type TokenScope,
} from "../lib/token/types";

interface TokenCommandOptions {
  env?: NodeJS.ProcessEnv;
  getConfig?: (env: NodeJS.ProcessEnv) => TokenEnvConfig;
  readSession?: () => AuthSession | null;
  exchangeRefreshToken?: (apiKey: string, refreshToken: string) => Promise<FirebaseIdTokenSession>;
  createToken?: (
    baseUrl: string,
    idToken: string,
    request: { name: string; scope?: TokenScope; expiresDays?: number },
    options?: { timeoutMs?: number },
  ) => Promise<CreatedTokenResponse>;
  listTokens?: (
    baseUrl: string,
    idToken: string,
    options?: { timeoutMs?: number },
  ) => Promise<ListTokensResponse>;
  revokeToken?: (
    baseUrl: string,
    idToken: string,
    tokenId: string,
    options?: { timeoutMs?: number },
  ) => Promise<RevokeTokenResponse>;
}

function printJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

async function resolveWriteToken(
  env: NodeJS.ProcessEnv,
  config: TokenEnvConfig,
  options: TokenCommandOptions,
): Promise<string | null> {
  const configured = resolveConfiguredAuthToken(env);
  if (configured) {
    return configured;
  }

  const session = (options.readSession ?? readAuthSession)();
  if (!session) {
    return null;
  }

  if (session.projectId && session.projectId !== config.firebaseProjectId) {
    throw new Error(
      `session project '${session.projectId}' does not match current config ` +
        `'${config.firebaseProjectId}'. Run 'skillmd login --reauth' to switch projects.`,
    );
  }

  const tokenSession = await (options.exchangeRefreshToken ?? exchangeRefreshTokenForIdToken)(
    config.firebaseApiKey,
    session.refreshToken,
  );
  return tokenSession.idToken;
}

function printListHuman(payload: ListTokensResponse): void {
  if (payload.tokens.length === 0) {
    console.log("No tokens found.");
    return;
  }

  for (const token of payload.tokens) {
    const revoked = token.revokedAt ? ` revoked=${token.revokedAt}` : "";
    const lastUsed = token.lastUsedAt ? ` lastUsed=${token.lastUsedAt}` : "";
    console.log(
      `${token.tokenId} ${token.scope} expires=${token.expiresAt} name="${token.name}"${revoked}${lastUsed}`,
    );
  }
}

export async function runTokenCommand(
  args: string[],
  options: TokenCommandOptions = {},
): Promise<number> {
  const parsed = parseTokenFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd token: unsupported argument(s)", TOKEN_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getConfig ?? getAuthRegistryEnvConfig)(env);
    const idToken = await resolveWriteToken(env, config, options);
    if (!idToken) {
      console.error("skillmd token: not logged in. Run 'skillmd login' first.");
      return 1;
    }

    if (parsed.action === "ls") {
      const result = await (options.listTokens ?? defaultListTokens)(
        config.registryBaseUrl,
        idToken,
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        printListHuman(result);
      }
      return 0;
    }

    if (parsed.action === "add") {
      const result = await (options.createToken ?? defaultCreateToken)(
        config.registryBaseUrl,
        idToken,
        {
          name: parsed.name,
          scope: parsed.scope,
          expiresDays: parsed.days,
        },
        { timeoutMs: config.requestTimeoutMs },
      );
      if (parsed.json) {
        printJson(result as unknown as Record<string, unknown>);
      } else {
        console.log(
          `Created token ${result.tokenId} (${result.scope}, expires ${result.expiresAt}).`,
        );
        console.log(`Token: ${result.token}`);
      }
      return 0;
    }

    const result = await (options.revokeToken ?? defaultRevokeToken)(
      config.registryBaseUrl,
      idToken,
      parsed.tokenId,
      { timeoutMs: config.requestTimeoutMs },
    );
    if (parsed.json) {
      printJson(result as unknown as Record<string, unknown>);
    } else {
      console.log(`Revoked token ${result.tokenId}.`);
    }
    return 0;
  } catch (error) {
    if (isTokenApiError(error)) {
      console.error(`skillmd token: ${error.message} (${error.code}, status ${error.status})`);
      return 1;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd token: ${message}`);
    return 1;
  }
}
