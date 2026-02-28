const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { scaffoldSkillInDirectory } = require("../dist/lib/scaffold.js");
const { validateSkill } = require("../dist/lib/validator.js");

function makeEmptySkillDirectory(skillName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skillmd-validator-test-"));
  const dir = path.join(root, skillName);
  fs.mkdirSync(dir);
  return { root, dir };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("passes for generated scaffold", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-pass");

  try {
    scaffoldSkillInDirectory(dir);
    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "passed");
  } finally {
    cleanup(root);
  }
});

test("fails when name does not match directory", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-name-mismatch");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(
      skillPath,
      content.replace("name: validator-name-mismatch", "name: other-name"),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /must match directory name/);
  } finally {
    cleanup(root);
  }
});

test("passes spec validation even when strict template section is missing", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-missing-section");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(skillPath, content.replace("## Examples\nTODO\n\n", ""), "utf8");

    const result = validateSkill(dir);
    assert.equal(result.status, "passed");
  } finally {
    cleanup(root);
  }
});

test("fails strict validation when strict template section is missing", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-missing-strict-section");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(skillPath, content.replace("## Examples\nTODO\n\n", ""), "utf8");

    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "failed");
    assert.match(result.message, /missing strict section: ## Examples/);
  } finally {
    cleanup(root);
  }
});

test("fails strict validation when section labels appear only in fenced code", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-fenced-headings");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = `---
name: validator-fenced-headings
description: "Valid description for spec checks."
license: TODO
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
`;
    fs.writeFileSync(skillPath, content, "utf8");

    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "failed");
    assert.match(result.message, /missing strict section: ## Scope/);
  } finally {
    cleanup(root);
  }
});

test("accepts BOM-prefixed SKILL.md frontmatter", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-bom");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(skillPath, `\uFEFF${content}`, "utf8");

    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "passed");
  } finally {
    cleanup(root);
  }
});

test("fails when description is invalid by spec", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-description");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(
      skillPath,
      content.replace(
        'description: "TODO: Describe what this skill does and when to use it."',
        "description:",
      ),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /description/);
  } finally {
    cleanup(root);
  }
});

test("fails when compatibility is empty", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-compat-empty");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(
      skillPath,
      content.replace("license: TODO", 'compatibility: ""\nlicense: TODO'),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /compatibility.*1-500/);
  } finally {
    cleanup(root);
  }
});

test("fails when compatibility exceeds 500 chars", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-compat-too-long");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    const longCompatibility = "a".repeat(501);
    fs.writeFileSync(
      skillPath,
      content.replace("license: TODO", `compatibility: "${longCompatibility}"\nlicense: TODO`),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /compatibility.*1-500/);
  } finally {
    cleanup(root);
  }
});

test("passes when compatibility is exactly 500 chars", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-compat-max");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    const maxCompatibility = "a".repeat(500);
    fs.writeFileSync(
      skillPath,
      content.replace("license: TODO", `compatibility: "${maxCompatibility}"\nlicense: TODO`),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "passed");
  } finally {
    cleanup(root);
  }
});

test("fails when metadata contains non-string values", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-metadata-values");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    const metadataBlock = [
      "metadata:",
      "  author: sample",
      "  version: 1",
      "  flags:",
      "    nested: true",
      "",
    ].join("\n");
    fs.writeFileSync(
      skillPath,
      content.replace("license: TODO\n---", `license: TODO\n${metadataBlock}---`),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /metadata.*string keys to string values/);
  } finally {
    cleanup(root);
  }
});

test("fails when compatibility is not a string", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-compat-type");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(
      skillPath,
      content.replace("license: TODO", "compatibility: 123\nlicense: TODO"),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /compatibility.*string/);
  } finally {
    cleanup(root);
  }
});

test("fails when allowed-tools is not a string", () => {
  const { root, dir } = makeEmptySkillDirectory("validator-allowed-tools");

  try {
    scaffoldSkillInDirectory(dir);
    const skillPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(
      skillPath,
      content.replace("license: TODO", "allowed-tools:\n  - Bash\nlicense: TODO"),
      "utf8",
    );

    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /allowed-tools.*string/);
  } finally {
    cleanup(root);
  }
});
