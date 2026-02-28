# MVP (v0): `skillmd init`

## Summary
`skillmd init` scaffolds a spec-aligned skill folder with a high-quality starting template.

This is the only supported command in v0.

---

## Non-goals (v0)
- No registry integration
- No publishing
- No validation command
- No network calls
- No execution runtime logic

---

## Output (minimum required structure)

Running `skillmd init` in an empty directory creates:

- `SKILL.md`
- `scripts/.gitkeep`
- `references/.gitkeep`
- `assets/.gitkeep`
- `.gitignore`

Optional future additions must not break this structure.

---

## Behavior Requirements

- If the target directory is non-empty, `init` exits with a clear, actionable error.
- Output must be deterministic:
  - No timestamps
  - No random IDs
  - No machine-specific paths
- Skill name must be normalized:
  - lowercase
  - hyphen-separated
  - max length enforced (per spec)

---

## SKILL.md Template Requirements

Generated `SKILL.md` must include:

### YAML Frontmatter
- `name`
- `description` (placeholder acceptable)
- `license` (optional)

### Markdown Sections (placeholders allowed)
- Scope
- When to use
- Inputs
- Outputs
- Steps / Procedure
- Examples
- Limitations / Failure modes
- Security / Tool access

---

## Definition of Done

- All files are created correctly.
- Template is readable and high quality.
- Tests cover name normalization and file generation.
- Re-running in same empty directory produces identical output.
