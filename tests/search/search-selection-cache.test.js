const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { makeTempDirectory, cleanupDirectory } = require("../helpers/fs-test-utils.js");

const { buildSearchContinuationKey, readSearchSelectionCache, writeSearchSelectionCache } =
  requireDist("lib/search/selection-cache.js");

const CACHE_TEST_PREFIX = "skillmd-search-cache-";

test("writeSearchSelectionCache and readSearchSelectionCache round-trip valid cache", () => {
  const root = makeTempDirectory(CACHE_TEST_PREFIX);
  const cachePath = path.join(root, ".skillmd", "search-cache.json");

  try {
    const expected = {
      registryBaseUrl: "https://registry.example.com",
      createdAt: "2026-03-02T12:00:00.000Z",
      skillIds: ["@core/one", "@core/two"],
      pageStartIndex: 21,
      continuations: [
        {
          key: buildSearchContinuationKey({
            registryBaseUrl: "https://registry.example.com",
            query: "agent",
            limit: 2,
            cursor: "cursor_2",
          }),
          nextIndex: 3,
          createdAt: "2026-03-02T12:01:00.000Z",
        },
      ],
    };
    writeSearchSelectionCache(expected, cachePath);

    const loaded = readSearchSelectionCache(cachePath);
    assert.deepEqual(loaded, expected);
  } finally {
    cleanupDirectory(root);
  }
});

test("buildSearchContinuationKey normalizes trailing slashes in registry url", () => {
  const keyA = buildSearchContinuationKey({
    registryBaseUrl: "https://registry.example.com/",
    query: "agent",
    limit: 2,
    cursor: "cursor_2",
  });
  const keyB = buildSearchContinuationKey({
    registryBaseUrl: "https://registry.example.com",
    query: "agent",
    limit: 2,
    cursor: "cursor_2",
  });

  assert.equal(keyA, keyB);
});

test("readSearchSelectionCache returns null when cache file is missing", () => {
  const root = makeTempDirectory(CACHE_TEST_PREFIX);
  const cachePath = path.join(root, ".skillmd", "search-cache.json");

  try {
    assert.equal(readSearchSelectionCache(cachePath), null);
  } finally {
    cleanupDirectory(root);
  }
});

test("readSearchSelectionCache returns null for malformed json", () => {
  const root = makeTempDirectory(CACHE_TEST_PREFIX);
  const cachePath = path.join(root, ".skillmd", "search-cache.json");

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, "{not-json", "utf8");
    assert.equal(readSearchSelectionCache(cachePath), null);
  } finally {
    cleanupDirectory(root);
  }
});

test("readSearchSelectionCache returns null for invalid cache shape", () => {
  const root = makeTempDirectory(CACHE_TEST_PREFIX);
  const cachePath = path.join(root, ".skillmd", "search-cache.json");

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@core/one", 2],
        },
        null,
        2,
      ),
      "utf8",
    );

    assert.equal(readSearchSelectionCache(cachePath), null);
  } finally {
    cleanupDirectory(root);
  }
});

test("readSearchSelectionCache returns null when pageStartIndex is invalid", () => {
  const root = makeTempDirectory(CACHE_TEST_PREFIX);
  const cachePath = path.join(root, ".skillmd", "search-cache.json");

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          registryBaseUrl: "https://registry.example.com",
          createdAt: "2026-03-02T12:00:00.000Z",
          skillIds: ["@core/one"],
          pageStartIndex: 0,
        },
        null,
        2,
      ),
      "utf8",
    );

    assert.equal(readSearchSelectionCache(cachePath), null);
  } finally {
    cleanupDirectory(root);
  }
});
