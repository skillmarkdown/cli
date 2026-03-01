# Roadmap

This roadmap outlines the next command surface for `skillmd` beyond v0.
It is intentionally abstract and will be refined into concrete technical plans per phase.

## Guiding principles

- Ship one major command at a time.
- Keep behavior deterministic where applicable.
- Preserve a clean CLI UX and stable command contracts.
- Avoid coupling future commands too tightly before requirements are validated.

## Planned sequence

1. `skillmd login`

Goal:
Establish authenticated user context for later remote operations.

2. `skillmd publish`

Goal:
Publish validated skills through the supported distribution flow.

3. `skillmd search`

Goal:
Discover published skills with a simple, reliable query UX.

4. `skillmd install`

Goal:
Install skills locally from search/discovery results or explicit identifiers.

## Optional

- `skillmd list`

Potential goal:
Show locally installed skills (and optionally remote-owned skills in a future extension).

## Notes

- Each command should get its own design and acceptance checklist before implementation.
- This roadmap is ordered by dependency and user flow, not by implementation complexity.
