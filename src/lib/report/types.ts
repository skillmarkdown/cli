export interface ReportEnvConfig {
  firebaseApiKey: string;
  firebaseProjectId: string;
  registryBaseUrl: string;
  requestTimeoutMs: number;
}

export type ReportMalwareReason =
  | "malware"
  | "credential_theft"
  | "data_exfiltration"
  | "obfuscation"
  | "impersonation"
  | "other";

export interface MalwareReportResponse {
  reportId: string;
  status: "received";
}

export interface MalwareReportRequest {
  skillId: string;
  reportedVersion: string;
  reason: ReportMalwareReason;
  description: string;
  sourceUrl: string;
  evidenceUrls: string[];
}

export type ParsedReportFlags =
  | {
      valid: true;
      action: "malware";
      json: boolean;
      request: MalwareReportRequest;
    }
  | { valid: false; json: false };
