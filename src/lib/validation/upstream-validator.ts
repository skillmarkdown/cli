import { spawnSync } from "node:child_process";

export type UpstreamValidationStatus = "passed" | "failed" | "unavailable";

export interface UpstreamValidationResult {
  status: UpstreamValidationStatus;
  message: string;
}

const SKILLS_REF_TIMEOUT_MS = 10_000;

function formatOutput(stdout: string, stderr: string): string {
  return [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join("\n");
}

export function validateWithSkillsRef(targetDir: string): UpstreamValidationResult {
  const result = spawnSync("skills-ref", ["validate", targetDir], {
    encoding: "utf8",
    timeout: SKILLS_REF_TIMEOUT_MS,
  });

  if (result.error) {
    if ("code" in result.error && result.error.code === "ENOENT") {
      return {
        status: "unavailable",
        message: "skills-ref is not installed or not on PATH",
      };
    }
    if ("code" in result.error && result.error.code === "ETIMEDOUT") {
      return {
        status: "unavailable",
        message: `skills-ref timed out after ${SKILLS_REF_TIMEOUT_MS}ms`,
      };
    }

    return {
      status: "unavailable",
      message: `skills-ref execution failed: ${result.error.message}`,
    };
  }

  const output = formatOutput(result.stdout ?? "", result.stderr ?? "");
  if (result.status === 0) {
    return {
      status: "passed",
      message: output || "skills-ref validation passed",
    };
  }

  return {
    status: "failed",
    message: output || "skills-ref validation failed",
  };
}
