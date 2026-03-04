const REDACTED_VALUE = "[REDACTED]";
const TOKEN_JSON_PATTERN = /("token"\s*:\s*")([^"]+)(")/gi;
const TOKEN_FORMAT_PATTERN = /\b(skmd_(?:live|dev)_tok_[a-z0-9]+\.)[A-Za-z0-9_-]+\b/gi;
const AUTH_HEADER_PATTERN = /(Authorization:\s*Bearer\s+)(\S+)/gi;
const AUTH_FLAG_PATTERN = /(--auth-token(?:=|\s+))(\S+)/gi;

export function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export function sanitizeText(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(TOKEN_JSON_PATTERN, `$1${REDACTED_VALUE}$3`)
    .replace(TOKEN_FORMAT_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(AUTH_HEADER_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(AUTH_FLAG_PATTERN, `$1${REDACTED_VALUE}`);
}

export function sanitizeArgs(args) {
  const sanitized = Array.isArray(args) ? [...args] : [];
  for (let index = 0; index < sanitized.length; index += 1) {
    const value = sanitized[index];
    if (typeof value !== "string") {
      continue;
    }

    if (value === "--auth-token") {
      if (typeof sanitized[index + 1] === "string") {
        sanitized[index + 1] = REDACTED_VALUE;
      }
      continue;
    }

    if (value.startsWith("--auth-token=")) {
      sanitized[index] = `--auth-token=${REDACTED_VALUE}`;
    }
  }

  return sanitized;
}

export function sanitizeStepForOutput(step) {
  return {
    ...step,
    args: sanitizeArgs(step.args),
    stdout: sanitizeText(step.stdout),
    stderr: sanitizeText(step.stderr),
    combined: sanitizeText(step.combined),
  };
}
