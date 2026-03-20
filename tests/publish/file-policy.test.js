const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { requireDist } = require("../helpers/dist-imports.js");
const { withSkillDirectory } = require("../helpers/skill-test-utils.js");

const {
  findBlockedPublishContentFiles,
  formatBlockedPublishContentMessage,
  listPublishableSkillFiles,
} = requireDist("lib/publish/file-policy.js");

const TEST_PREFIX = "skillmd-file-policy-test-";

test("allows reviewable text-first files", () => {
  withSkillDirectory(TEST_PREFIX, "text-only", ({ dir }) => {
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      "---\nname: text-only\ndescription: ok\n---\n",
      "utf8",
    );
    fs.writeFileSync(path.join(dir, "LICENSE"), "MIT\n", "utf8");
    fs.mkdirSync(path.join(dir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "references", "schema.graphql"),
      "type Query { ok: Boolean }\n",
    );
    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "assets", "diagram.svg"), "<svg></svg>", "utf8");

    const files = listPublishableSkillFiles(dir);
    assert.deepEqual(findBlockedPublishContentFiles(dir, files), []);
  });
});

test("blocks unsupported file types even if the contents are text", () => {
  withSkillDirectory(TEST_PREFIX, "blocked-text-extension", ({ dir }) => {
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      "---\nname: blocked-text-extension\ndescription: ok\n---\n",
      "utf8",
    );
    fs.mkdirSync(path.join(dir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "references", "guide.PDF"),
      "plain text but wrong type",
      "utf8",
    );

    const violations = findBlockedPublishContentFiles(dir, listPublishableSkillFiles(dir));
    assert.deepEqual(violations, [
      { path: "references/guide.PDF", reason: "unsupported-file-type" },
    ]);
  });
});

test("blocks binary content hidden behind an allowlisted extension", () => {
  withSkillDirectory(TEST_PREFIX, "binary-json", ({ dir }) => {
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      "---\nname: binary-json\ndescription: ok\n---\n",
      "utf8",
    );
    fs.mkdirSync(path.join(dir, "references"), { recursive: true });
    fs.writeFileSync(path.join(dir, "references", "data.JSON"), Buffer.from([0x7b, 0x00, 0x7d]));

    const violations = findBlockedPublishContentFiles(dir, listPublishableSkillFiles(dir));
    assert.deepEqual(violations, [
      { path: "references/data.JSON", reason: "binary-content-detected" },
    ]);
  });
});

test("formats violations with stable reason text", () => {
  const message = formatBlockedPublishContentMessage([
    { path: "assets/logo.png", reason: "unsupported-file-type" },
    { path: "references/data.json", reason: "binary-content-detected" },
  ]);

  assert.match(message, /assets\/logo\.png/);
  assert.match(message, /unsupported file type/);
  assert.match(message, /references\/data\.json/);
  assert.match(message, /binary content detected/);
});
