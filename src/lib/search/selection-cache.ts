import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SEARCH_SELECTION_PATH = join(homedir(), ".skillmd", "search-cache.json");

export interface SearchSelectionContinuation {
  key: string;
  nextIndex: number;
  createdAt: string;
}

export interface SearchSelectionCache {
  registryBaseUrl: string;
  createdAt: string;
  skillIds: string[];
  pageStartIndex?: number;
  continuations?: SearchSelectionContinuation[];
}

export function getDefaultSearchSelectionCachePath(): string {
  return SEARCH_SELECTION_PATH;
}

function isValidCacheValue(value: unknown): value is SearchSelectionCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<SearchSelectionCache>;
  if (typeof record.registryBaseUrl !== "string" || record.registryBaseUrl.length === 0) {
    return false;
  }
  if (typeof record.createdAt !== "string" || record.createdAt.length === 0) {
    return false;
  }
  if (!Array.isArray(record.skillIds)) {
    return false;
  }

  for (const skillId of record.skillIds) {
    if (typeof skillId !== "string" || skillId.length === 0) {
      return false;
    }
  }

  if (record.pageStartIndex !== undefined) {
    if (
      typeof record.pageStartIndex !== "number" ||
      !Number.isInteger(record.pageStartIndex) ||
      record.pageStartIndex < 1
    ) {
      return false;
    }
  }

  if (record.continuations !== undefined) {
    if (!Array.isArray(record.continuations)) {
      return false;
    }

    for (const continuation of record.continuations) {
      if (!continuation || typeof continuation !== "object") {
        return false;
      }

      const entry = continuation as Partial<SearchSelectionContinuation>;
      if (typeof entry.key !== "string" || entry.key.length === 0) {
        return false;
      }
      if (
        typeof entry.nextIndex !== "number" ||
        !Number.isInteger(entry.nextIndex) ||
        entry.nextIndex < 1
      ) {
        return false;
      }
      if (typeof entry.createdAt !== "string" || entry.createdAt.length === 0) {
        return false;
      }
    }
  }

  return true;
}

function normalizeRegistryBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "");
}

export function buildSearchContinuationKey(params: {
  registryBaseUrl: string;
  query: string | null;
  limit: number;
  cursor: string;
}): string {
  return JSON.stringify([
    normalizeRegistryBaseUrl(params.registryBaseUrl),
    params.query ?? null,
    params.limit,
    params.cursor,
  ]);
}

export function readSearchSelectionCache(
  cachePath: string = SEARCH_SELECTION_PATH,
): SearchSelectionCache | null {
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as unknown;
    if (!isValidCacheValue(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeSearchSelectionCache(
  cache: SearchSelectionCache,
  cachePath: string = SEARCH_SELECTION_PATH,
): void {
  const parentDir = dirname(cachePath);
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), { encoding: "utf8", mode: 0o600 });
  chmodSync(cachePath, 0o600);
}
