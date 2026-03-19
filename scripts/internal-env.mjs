import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const USER_ENV_PATH = join(homedir(), ".skillmd", ".env");

function parseDotEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      values[key] = value;
    }
  }

  return values;
}

export function loadInternalScriptEnv(baseEnv = process.env) {
  const dotEnv = existsSync(USER_ENV_PATH) ? parseDotEnv(readFileSync(USER_ENV_PATH, "utf8")) : {};
  return {
    ...dotEnv,
    ...baseEnv,
  };
}
