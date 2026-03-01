const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { scaffoldSkillInDirectory } = require("../dist/lib/scaffold.js");
const { validateSkill } = require("../dist/lib/validator.js");
const { createSkillDirectoryFactory, cleanupDirectory } = require("./helpers/fs-test-utils.js");

const makeEmptySkillDirectory = createSkillDirectoryFactory("skillmd-validator-test-");
const SKILL_MD = "SKILL.md";

function withSkillDirectory(skillName, run) {
  const { root, dir } = makeEmptySkillDirectory(skillName);
  try {
    run(dir);
  } finally {
    cleanupDirectory(root);
  }
}

function withScaffoldedSkillDirectory(skillName, run) {
  withSkillDirectory(skillName, (dir) => {
    scaffoldSkillInDirectory(dir, { template: "verbose" });
    run(dir);
  });
}

function readSkillMarkdown(dir) {
  return fs.readFileSync(path.join(dir, SKILL_MD), "utf8");
}

function writeSkillMarkdown(dir, content) {
  fs.writeFileSync(path.join(dir, SKILL_MD), content, "utf8");
}

function patchSkillMarkdown(dir, patcher) {
  writeSkillMarkdown(dir, patcher(readSkillMarkdown(dir)));
}

test("passes for generated scaffold", () => {
  withScaffoldedSkillDirectory("validator-pass", (dir) => {
    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "passed");
  });
});

test("fails when SKILL.md frontmatter is invalid YAML", () => {
  withSkillDirectory("validator-invalid-yaml", (dir) => {
    writeSkillMarkdown(dir, "---\nname: ok\ndescription: [bad\n---\n\nBody\n");
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /valid YAML frontmatter/);
  });
});

test("fails when frontmatter parses to non-object value", () => {
  withSkillDirectory("validator-non-object-frontmatter", (dir) => {
    writeSkillMarkdown(dir, "---\n- just\n- a\n- list\n---\n\nBody\n");
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /valid YAML frontmatter/);
  });
});

test("fails when name does not match directory", () => {
  withScaffoldedSkillDirectory("validator-name-mismatch", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace("name: validator-name-mismatch", "name: other-name"),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /must match directory name/);
  });
});

test("fails when name has invalid format", () => {
  withScaffoldedSkillDirectory("validator-name-format", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace("name: validator-name-format", "name: Bad_Name"),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /must be 1-64 chars/);
  });
});

test("fails when name exceeds 64 chars", () => {
  withScaffoldedSkillDirectory("validator-name-too-long", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace("name: validator-name-too-long", `name: ${"a".repeat(65)}`),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /must be 1-64 chars/);
  });
});

test("passes spec validation even when strict template section is missing", () => {
  withScaffoldedSkillDirectory("validator-missing-section", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace(/## Examples[\s\S]*?(\n\n## Limitations \/ Failure modes)/, "$1"),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "passed");
  });
});

test("fails strict validation when strict template section is missing", () => {
  withScaffoldedSkillDirectory("validator-missing-strict-section", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace(/## Examples[\s\S]*?(\n\n## Limitations \/ Failure modes)/, "$1"),
    );
    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "failed");
    assert.match(result.message, /missing strict section: ## Examples/);
  });
});

test("fails strict validation when section labels appear only in fenced code", () => {
  withScaffoldedSkillDirectory("validator-fenced-headings", (dir) => {
    const content = `---
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
`;
    writeSkillMarkdown(dir, content);
    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "failed");
    assert.match(result.message, /missing strict section: ## Scope/);
  });
});

test("accepts BOM-prefixed SKILL.md frontmatter", () => {
  withScaffoldedSkillDirectory("validator-bom", (dir) => {
    patchSkillMarkdown(dir, (content) => `\uFEFF${content}`);
    const result = validateSkill(dir, { strict: true });
    assert.equal(result.status, "passed");
  });
});

test("fails when description is invalid by spec", () => {
  withScaffoldedSkillDirectory("validator-description", (dir) => {
    patchSkillMarkdown(dir, (content) => content.replace(/^description:.*$/m, "description:"));
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /description/);
  });
});

test("fails when license is not a string", () => {
  withScaffoldedSkillDirectory("validator-license-type", (dir) => {
    patchSkillMarkdown(dir, (content) => content.replace(/^license:.*$/m, "license: 123"));
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /license.*string/);
  });
});

test("fails when compatibility is empty", () => {
  withScaffoldedSkillDirectory("validator-compat-empty", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace(/^license:.*$/m, 'compatibility: ""\nlicense: Optional.'),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /compatibility.*1-500/);
  });
});

test("fails when compatibility exceeds 500 chars", () => {
  withScaffoldedSkillDirectory("validator-compat-too-long", (dir) => {
    const longCompatibility = "a".repeat(501);
    patchSkillMarkdown(dir, (content) =>
      content.replace(/^license:.*$/m, `compatibility: "${longCompatibility}"\nlicense: Optional.`),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /compatibility.*1-500/);
  });
});

test("passes when compatibility is exactly 500 chars", () => {
  withScaffoldedSkillDirectory("validator-compat-max", (dir) => {
    const maxCompatibility = "a".repeat(500);
    patchSkillMarkdown(dir, (content) =>
      content.replace(/^license:.*$/m, `compatibility: "${maxCompatibility}"\nlicense: Optional.`),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "passed");
  });
});

test("fails when metadata contains non-string values", () => {
  withScaffoldedSkillDirectory("validator-metadata-values", (dir) => {
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

test("fails when compatibility is not a string", () => {
  withScaffoldedSkillDirectory("validator-compat-type", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace(/^license:.*$/m, "compatibility: 123\nlicense: Optional."),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /compatibility.*string/);
  });
});

test("fails when allowed-tools is not a string", () => {
  withScaffoldedSkillDirectory("validator-allowed-tools", (dir) => {
    patchSkillMarkdown(dir, (content) =>
      content.replace(/^license:.*$/m, "allowed-tools:\n  - Bash\nlicense: Optional."),
    );
    const result = validateSkill(dir);
    assert.equal(result.status, "failed");
    assert.match(result.message, /allowed-tools.*string/);
  });
});
