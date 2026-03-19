const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function importWithHome(homeDir) {
  const moduleUrl = pathToFileURL(path.join(process.cwd(), "scripts", "internal-env.mjs")).href;
  const originalHomedir = os.homedir;
  os.homedir = () => homeDir;
  try {
    return await import(`${moduleUrl}?home=${encodeURIComponent(homeDir)}`);
  } finally {
    os.homedir = originalHomedir;
  }
}

test("loadInternalScriptEnv merges ~/.skillmd/.env with process env overrides", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillmd-internal-env-"));
  fs.mkdirSync(path.join(homeDir, ".skillmd"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, ".skillmd", ".env"),
    [
      "SKILLMD_FIREBASE_API_KEY=file-api-key",
      "SKILLMD_LOGIN_EMAIL=file@example.com",
      "SKILLMD_LOGIN_PASSWORD=file-password",
    ].join("\n"),
    "utf8",
  );

  try {
    const { loadInternalScriptEnv } = await importWithHome(homeDir);
    const env = loadInternalScriptEnv({
      SKILLMD_LOGIN_EMAIL: "process@example.com",
      EXTRA_FLAG: "1",
    });

    assert.equal(env.SKILLMD_FIREBASE_API_KEY, "file-api-key");
    assert.equal(env.SKILLMD_LOGIN_EMAIL, "process@example.com");
    assert.equal(env.SKILLMD_LOGIN_PASSWORD, "file-password");
    assert.equal(env.EXTRA_FLAG, "1");
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
