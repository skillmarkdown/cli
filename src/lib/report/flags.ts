import { parseSkillId } from "../registry/skill-id";
import { parseOptionValue } from "../shared/flag-parse";
import {
  type MalwareReportRequest,
  type ParsedReportFlags,
  type ReportMalwareReason,
} from "./types";

const REPORT_MALWARE_REASONS: Set<ReportMalwareReason> = new Set([
  "malware",
  "credential_theft",
  "data_exfiltration",
  "obfuscation",
  "impersonation",
  "other",
]);

const DESCRIPTION_LIMIT = 4000;
const EVIDENCE_URL_LIMIT = 5;
const SOURCE_URL_PROTOCOLS = new Set(["http:", "https:"]);

function isReportMalwareReason(value: string): value is ReportMalwareReason {
  return REPORT_MALWARE_REASONS.has(value as ReportMalwareReason);
}

function trimValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return SOURCE_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function parseReportFlags(args: string[]): ParsedReportFlags {
  if (args.length === 0 || args[0] !== "malware") {
    return { valid: false, json: false };
  }

  const skillIdRaw = args[1]?.trim();
  if (!skillIdRaw) {
    return { valid: false, json: false };
  }

  let skillId: string;
  try {
    skillId = parseSkillId(skillIdRaw).skillId;
  } catch {
    return { valid: false, json: false };
  }

  let reason: ReportMalwareReason | null = null;
  let description = "";
  let reportedVersion = "";
  let sourceUrl = "";
  const evidenceUrls: string[] = [];
  let json = false;

  for (let index = 2; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--json") {
      json = true;
      continue;
    }

    const reasonOption = parseOptionValue(args, index, "reason", { allowEmptyValue: true });
    if (reasonOption.matched) {
      const value = trimValue(reasonOption.value);
      if (!value || !isReportMalwareReason(value)) {
        return { valid: false, json: false };
      }
      reason = value;
      index = reasonOption.nextIndex;
      continue;
    }

    const descriptionOption = parseOptionValue(args, index, "description", {
      allowEmptyValue: true,
    });
    if (descriptionOption.matched) {
      description = trimValue(descriptionOption.value);
      if (!description || description.length > DESCRIPTION_LIMIT) {
        return { valid: false, json: false };
      }
      index = descriptionOption.nextIndex;
      continue;
    }

    const versionOption = parseOptionValue(args, index, "reported-version", {
      allowEmptyValue: true,
    });
    if (versionOption.matched) {
      reportedVersion = trimValue(versionOption.value);
      if (!reportedVersion) {
        return { valid: false, json: false };
      }
      index = versionOption.nextIndex;
      continue;
    }

    const sourceUrlOption = parseOptionValue(args, index, "source-url", { allowEmptyValue: true });
    if (sourceUrlOption.matched) {
      sourceUrl = trimValue(sourceUrlOption.value);
      if (!sourceUrl || !isHttpUrl(sourceUrl)) {
        return { valid: false, json: false };
      }
      index = sourceUrlOption.nextIndex;
      continue;
    }

    const evidenceUrlOption = parseOptionValue(args, index, "evidence-url", {
      allowEmptyValue: true,
    });
    if (evidenceUrlOption.matched) {
      const evidenceUrl = trimValue(evidenceUrlOption.value);
      if (!evidenceUrl || evidenceUrls.length >= EVIDENCE_URL_LIMIT || !isHttpUrl(evidenceUrl)) {
        return { valid: false, json: false };
      }
      evidenceUrls.push(evidenceUrl);
      index = evidenceUrlOption.nextIndex;
      continue;
    }

    return { valid: false, json: false };
  }

  if (!reason || !description || !reportedVersion || !sourceUrl) {
    return { valid: false, json: false };
  }

  const request: MalwareReportRequest = {
    skillId,
    reportedVersion,
    reason,
    description,
    sourceUrl,
    evidenceUrls,
  };

  return { valid: true, action: "malware", json, request };
}
