const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  patchSkillMarkdown,
  withScaffoldedSkillDirectory,
  withSkillDirectory,
  writeSkillMarkdown,
} = require("../helpers/skill-test-utils.js");

const { validateSkill } = requireDist("lib/validator.js");

const SKILL_PREFIX = "skillmd-validator-test-";

function withVerboseSkill(name, run) {
  return withScaffoldedSkillDirectory(SKILL_PREFIX, name, "verbose", run);
}

function expectValidation(skillName, patcher, expectedStatus, messagePattern, options) {
  withVerboseSkill(skillName, ({ dir }) => {
    patchSkillMarkdown(dir, patcher);
    const result = validateSkill(dir, options);
    assert.equal(result.status, expectedStatus);
    if (messagePattern) {
      assert.match(result.message, messagePattern);
    }
  });
}

test("passes for generated scaffold", () => {
  withVerboseSkill("validator-pass", ({ dir }) => {
    assert.equal(validateSkill(dir, { strict: true }).status, "passed");
  });
});

for (const [index, name, content] of [
  [
    1,
    "fails when SKILL.md frontmatter is invalid YAML",
    "---\nname: ok\ndescription: [bad\n---\n\nBody\n",
  ],
  [
    2,
    "fails when frontmatter parses to non-object value",
    "---\n- just\n- a\n- list\n---\n\nBody\n",
  ],
]) {
  test(name, () => {
    withSkillDirectory(SKILL_PREFIX, `validator-frontmatter-${index}`, ({ dir }) => {
      writeSkillMarkdown(dir, content);
      const result = validateSkill(dir);
      assert.equal(result.status, "failed");
      assert.match(result.message, /valid YAML frontmatter/);
    });
  });
}

for (const [name, skillName, patcher, messagePattern] of [
  [
    "fails when name does not match directory",
    "validator-name-mismatch",
    (content) => content.replace("name: validator-name-mismatch", "name: other-name"),
    /must match directory name/,
  ],
  [
    "fails when name has invalid format",
    "validator-name-format",
    (content) => content.replace("name: validator-name-format", "name: Bad_Name"),
    /must be 1-64 chars/,
  ],
  [
    "fails when name exceeds 64 chars",
    "validator-name-too-long",
    (content) => content.replace("name: validator-name-too-long", `name: ${"a".repeat(65)}`),
    /must be 1-64 chars/,
  ],
]) {
  test(name, () => expectValidation(skillName, patcher, "failed", messagePattern));
}

test("passes spec validation even when strict template section is missing", () => {
  expectValidation(
    "validator-missing-section",
    (content) => content.replace(/## Examples[\s\S]*?(\n\n## Limitations \/ Failure modes)/, "$1"),
    "passed",
  );
});

test("fails strict validation when strict template section is missing", () => {
  expectValidation(
    "validator-missing-strict-section",
    (content) => content.replace(/## Examples[\s\S]*?(\n\n## Limitations \/ Failure modes)/, "$1"),
    "failed",
    /missing strict section: ## Examples/,
    { strict: true },
  );
});

test("fails strict validation when section labels appear only in fenced code", () => {
  withVerboseSkill("validator-fenced-headings", ({ dir }) => {
    writeSkillMarkdown(
      dir,
      `---
name: validator-fenced-headings
description: "Valid description for spec checks."
license: Optional. Add a license name or reference to a bundled license file.
---

\`\`\`md
## Scope
## When to use
## Inputs
## Outputs
## Steps / Procedure
## Examples
## Limitations / Failure modes
## Security / Tool access
\`\`\`
`,
    );

    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "failed");
    assert.match(result.message, /missing strict section: ## Scope/);
  });
});

test("accepts BOM-prefixed SKILL.md frontmatter", () => {
  expectValidation("validator-bom", (content) => `\uFEFF${content}`, "passed", null, {
    strict: true,
  });
});

for (const [name, skillName, patcher, status, pattern] of [
  [
    "fails when description is invalid by spec",
    "validator-description",
    (content) => content.replace(/^description:.*$/m, "description:"),
    "failed",
    /description/,
  ],
  [
    "fails when license is not a string",
    "validator-license-type",
    (content) => content.replace(/^license:.*$/m, "license: 123"),
    "failed",
    /license.*string/,
  ],
  [
    "fails when compatibility is empty",
    "validator-compat-empty",
    (content) => content.replace(/^license:.*$/m, 'compatibility: ""\nlicense: Optional.'),
    "failed",
    /compatibility.*1-500/,
  ],
  [
    "fails when compatibility exceeds 500 chars",
    "validator-compat-too-long",
    (content) =>
      content.replace(/^license:.*$/m, `compatibility: "${"a".repeat(501)}"\nlicense: Optional.`),
    "failed",
    /compatibility.*1-500/,
  ],
  [
    "passes when compatibility is exactly 500 chars",
    "validator-compat-max",
    (content) =>
      content.replace(/^license:.*$/m, `compatibility: "${"a".repeat(500)}"\nlicense: Optional.`),
    "passed",
    null,
  ],
  [
    "fails when compatibility is not a string",
    "validator-compat-type",
    (content) => content.replace(/^license:.*$/m, "compatibility: 123\nlicense: Optional."),
    "failed",
    /compatibility.*string/,
  ],
  [
    "fails when allowed-tools is not a string",
    "validator-allowed-tools",
    (content) => content.replace(/^license:.*$/m, "allowed-tools:\n  - Bash\nlicense: Optional."),
    "failed",
    /allowed-tools.*string/,
  ],
]) {
  test(name, () => expectValidation(skillName, patcher, status, pattern));
}

test("fails when metadata contains non-string values", () => {
  withVerboseSkill("validator-metadata-values", ({ dir }) => {
    const metadataBlock = [
      "metadata:",
      "  author: sample",
      "  version: 1",
      "  flags:",
      "    nested: true",
      "",
    ].join("\n");

    patchSkillMarkdown(dir, (content) =>
      content.replace(/^license:.*\n---/m, `license: Optional.\n${metadataBlock}---`),
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /metadata.*string keys to string values/);
  });
});
