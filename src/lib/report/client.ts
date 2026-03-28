import { extractApiErrorFields, requestJson, type ApiErrorPayload } from "../shared/api-client";
import { ReportApiError } from "./errors";
import { type MalwareReportRequest, type MalwareReportResponse } from "./types";

interface ReportClientOptions {
  timeoutMs?: number;
}

function toReportApiError(status: number, payload: ApiErrorPayload): ReportApiError {
  const parsed = extractApiErrorFields(
    status,
    payload,
    `security report API request failed (${status})`,
  );
  return new ReportApiError(status, parsed.code, parsed.message, parsed.details);
}

function isMalwareReportResponse(value: unknown): value is MalwareReportResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.status === "received" && typeof record.reportId === "string";
}

export async function submitMalwareReport(
  baseUrl: string,
  idToken: string,
  request: MalwareReportRequest,
  options: ReportClientOptions = {},
): Promise<MalwareReportResponse> {
  return requestJson<MalwareReportResponse, ReportApiError>({
    url: new URL("/v1/security/report-malware", baseUrl),
    method: "POST",
    idToken,
    body: request,
    timeoutMs: options.timeoutMs,
    label: "report malware",
    isValid: isMalwareReportResponse,
    missingFieldsMessage: "report malware response missing required fields",
    toApiError: toReportApiError,
  });
}
