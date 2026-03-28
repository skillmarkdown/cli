import { resolveWriteAuth } from "../lib/auth/write-auth";
import { submitMalwareReport as defaultSubmitMalwareReport } from "../lib/report/client";
import { isReportApiError } from "../lib/report/errors";
import { parseReportFlags } from "../lib/report/flags";
import { type MalwareReportResponse, type ReportEnvConfig } from "../lib/report/types";
import { failWithUsage } from "../lib/shared/command-output";
import { getAuthRegistryEnvConfig } from "../lib/shared/env-config";
import { executeWriteCommand } from "../lib/shared/command-execution";
import { REPORT_USAGE } from "../lib/shared/cli-text";

interface ReportCommandOptions {
  env?: NodeJS.ProcessEnv;
  getAuthConfig?: (env: NodeJS.ProcessEnv) => ReportEnvConfig;
  submitMalwareReport?: (
    baseUrl: string,
    idToken: string,
    request: {
      skillId: string;
      reportedVersion: string;
      reason:
        | "malware"
        | "credential_theft"
        | "data_exfiltration"
        | "obfuscation"
        | "impersonation"
        | "other";
      description: string;
      sourceUrl: string;
      evidenceUrls: string[];
    },
    options?: { timeoutMs?: number },
  ) => Promise<MalwareReportResponse>;
}

export async function runReportCommand(
  args: string[],
  options: ReportCommandOptions = {},
): Promise<number> {
  const parsed = parseReportFlags(args);
  if (!parsed.valid) {
    return failWithUsage("skillmd report: unsupported argument(s)", REPORT_USAGE);
  }

  try {
    const env = options.env ?? process.env;
    const config = (options.getAuthConfig ?? getAuthRegistryEnvConfig)(env);
    const resolveReportWriteAuth = async () => {
      const auth = await resolveWriteAuth({
        command: "skillmd report",
        env,
        config,
      });
      return auth.ok
        ? { ok: true as const, idToken: auth.value.idToken }
        : { ok: false as const, message: auth.message };
    };

    return executeWriteCommand<MalwareReportResponse>({
      command: "skillmd report",
      json: parsed.json,
      resolveAuth: resolveReportWriteAuth,
      run: (idToken) =>
        (options.submitMalwareReport ?? defaultSubmitMalwareReport)(
          config.registryBaseUrl,
          idToken,
          parsed.request,
          { timeoutMs: config.requestTimeoutMs },
        ),
      printHuman: (result) => {
        console.log(`Malware report submitted for ${parsed.request.skillId}.`);
        console.log(`Status: ${result.status}`);
        console.log(`Report ID: ${result.reportId}`);
      },
      isApiError: isReportApiError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`skillmd report: ${message}`);
    return 1;
  }
}
