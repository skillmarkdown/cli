# @skillmarkdown/cli

`@skillmarkdown/cli` is the official CLI for scaffolding, validating, and packaging `SKILL.md`-based AI skills. It provides the `skillmd` command, starting with deterministic, spec-aligned skill scaffolding via `skillmd init`.

## Status
Early development. v0 focuses on `skillmd init`. Docs are intentionally lightweight and may evolve.

## Install

### Global install
```bash
npm i -g @skillmarkdown/cli
```

### Run without installing
```bash
npx @skillmarkdown/cli init
```

## Usage

### Initialize a skill folder
```bash
skillmd init
```

This scaffolds a spec-aligned skill structure including `SKILL.md` and optional directories (`scripts/`, `references/`, `assets/`).

## Links
- Agent Skills spec: https://agentskills.io/specification

## License
MIT
