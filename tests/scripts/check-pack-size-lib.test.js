const test = require("node:test");
const assert = require("node:assert/strict");

async function loadModule() {
  return import("../../scripts/check-pack-size-lib.mjs");
}

test("parsePackJson parses direct npm --json payload", async () => {
  const { parsePackJson } = await loadModule();
  const parsed = parsePackJson(
    JSON.stringify([{ name: "@skillmarkdown/cli", unpackedSize: 123, files: [] }]),
  );
  assert.equal(parsed.unpackedSize, 123);
});

test("parsePackJson parses payload with log prefix noise", async () => {
  const { parsePackJson } = await loadModule();
  const parsed = parsePackJson(
    "npm notice something\\n" +
      JSON.stringify([{ name: "@skillmarkdown/cli", unpackedSize: 321, files: [] }]),
  );
  assert.equal(parsed.unpackedSize, 321);
});

test("hasPackedFile detects required dist artifact", async () => {
  const { hasPackedFile } = await loadModule();
  assert.equal(
    hasPackedFile(
      [
        { path: "README.md", size: 10 },
        { path: "dist/cli.js", size: 20 },
      ],
      "dist/cli.js",
    ),
    true,
  );
  assert.equal(hasPackedFile([{ path: "README.md", size: 10 }], "dist/cli.js"), false);
});
