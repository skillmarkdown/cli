# CLI Review 2026-03-26

## Summary

The CLI is in strong shape structurally. Command families are organized consistently, auth precedence is coherent, JSON output discipline is good, and the shipped command surface is now much closer to backend parity after the recent org, collaborator, account, and malware-report additions.

I did not find any blocking correctness issues in the current code paths. The main gap exposed by this review is public documentation drift: the README command inventory and top-level usage narrative have not been updated to reflect the newly shipped `account`, `report`, and `collaborators` surfaces.

## Current Strengths

- Strong command-family structure under `src/commands` and `src/lib/<domain>`.
- Shared read/write execution helpers keep auth, JSON output, and API error handling consistent.
- Command-matrix coverage is in place and now tracks shipped top-level command families.
- Validation discipline is strong across flags, payload shapes, and malformed API responses.
- Test coverage is broad and fast enough to be used as a real release gate.
- The CLI remains agent-friendly: deterministic flags, stable JSON output, and low reliance on interactive prompts.

## Reviewed Areas

- Root dispatch and help surface
- Auth precedence and session/write-auth behavior
- Org and collaborator command completeness
- Newly added account delete/support commands
- Newly added malware reporting command
- Command-matrix coverage and contract tests
- Public docs and command inventory consistency

## Finding

### README command inventory is stale

The public README still presents the CLI as if the main account/access surface stops at `login`, `logout`, `whoami`, `token`, and `org`, even though `collaborators`, `account`, and `report` are now first-class shipped command families. That is not a runtime bug, but it does create contract drift for users and automation authors who rely on the README as the install-time source of truth.

Impacted area:

- `README.md`

Recommended remediation:

- Update the `Commands` section to include `collaborators`, `account`, and `report`.
- Add one short examples block for at least one destructive/account flow and one reporting flow.
- Reconcile the README command inventory with `src/lib/shared/cli-text.ts` whenever new top-level families are shipped.

## Future Improvements

These are not current bugs. They are the next most valuable improvements if CLI work continues.

- Update README and npm-facing product copy away from heavy `registry` wording as market terminology evolves.
- Add a small release/docs check that compares README command inventory against the command matrix or `ROOT_USAGE`.
- Consider a dedicated `--help` test sweep if help output becomes a formal public contract.
- Keep the untracked missing-commands inventory current or replace it with a committed roadmap/status doc so it does not drift from shipped reality.

## Overall Assessment

The CLI is production-capable and structurally healthy. The recent parity work materially improved the operator surface without introducing obvious contract or test gaps. The next highest-value step is documentation tightening rather than more foundational refactoring.
