# Internal Env

Dev-only scripts and strict release checks load credentials from:

1. the current shell environment
2. `~/.skillmd/.env`

Shell values override `~/.skillmd/.env`.

## Shared Dev Variables

- `SKILLMD_FIREBASE_API_KEY`
- `SKILLMD_LOGIN_EMAIL`
- `SKILLMD_LOGIN_PASSWORD`
- `SKILLMD_PRO_LOGIN_EMAIL`
- `SKILLMD_PRO_LOGIN_PASSWORD`
- `SKILLMD_E2E_ORG_SLUG`

Optional overrides:

- `SKILLMD_DEV_FIREBASE_API_KEY`
- `SKILLMD_PROD_FIREBASE_API_KEY`
- `SKILLMD_E2E_PRIVATE_CURSOR_QUERY`
- `SKILLMD_QUOTA_FREE_EMAIL`
- `SKILLMD_QUOTA_FREE_PASSWORD`
- `SKILLMD_QUOTA_FREE_USERNAME`
- `SKILLMD_QUOTA_PRO_EMAIL`
- `SKILLMD_QUOTA_PRO_PASSWORD`
- `SKILLMD_QUOTA_PRO_USERNAME`

## Current Dev Fixtures

These identifiers are the current local dev fixture targets used by strict CLI sweeps:

- standard login fixture email: `test@stefdevs.com`
- secondary login fixture email: `pro@stefdevs.com`
- standard login fixture username: `test`
- secondary login fixture username: `prostefdevs`
- org fixture slug: `huggingface`
- dev Firebase project: `skillmarkdown-development`
- dev registry base URL: `https://registryapi-sm46rm3rja-uc.a.run.app`

Keep passwords and live secrets in local `~/.skillmd/.env`, not in repo-tracked docs.

## Current Production Public Endpoints

Canonical production URLs:

- production Firebase project: `skillmarkdown`
- production web URL: `https://skillmarkdown.com`
- production web alias URL: `https://www.skillmarkdown.com`
- production registry URL: `https://registry.skillmarkdown.com`

Direct fallback production URLs:

- production App Hosting URL: `https://web-nextjs--skillmarkdown.us-central1.hosted.app`
- production Cloud Run registry URL: `https://registryapi-pfd5mx23uq-uc.a.run.app`

Observed status on `2026-03-22`:

- `skillmarkdown.com` is live and currently responds with `401 Basic realm="Restricted"`
- `www.skillmarkdown.com` is live and currently responds with `401 Basic realm="Restricted"`
- `https://registry.skillmarkdown.com/v1/healthz` returns `200`
- keep the direct App Hosting and direct Cloud Run endpoints as fallbacks

## Replayable Fixture Setup

To recreate the strict dev auth/org fixtures from the CLI repo:

```bash
cd /Users/azk/Desktop/workspace/skillmarkdown/cli
npm run fixtures:dev:ensure
```

What it does:

- ensures the free fixture auth user exists as `test@stefdevs.com` / `test`
- ensures the Pro fixture auth user exists as `pro@stefdevs.com` / `prostefdevs`
- forces the Pro fixture plan to `pro`
- ensures the dev org fixture slug exists
- verifies the Pro fixture resolves `plan=pro` plus private-skill entitlements
- seeds a minimum private-search pagination corpus for the `cursorseed` query under the Pro fixture

This script uses:

- repo-local CLI build output at `dist/cli.js`
- backend admin helpers in `/Users/azk/Desktop/workspace/skillmarkdown/functions/functions/scripts`
- an isolated temporary `HOME` during login/org verification so local sessions are not overwritten

## Replayable Org Quota Probe

To verify the live dev org quotas end to end from the CLI repo:

```bash
cd /Users/azk/Desktop/workspace/skillmarkdown/cli
npm run e2e:org-quotas:dev
```

What it does:

- ensures dedicated free and Pro quota fixture users exist
- forces their plans to `free` and `pro`
- deletes all existing organization memberships owned by those quota fixtures
- creates `5` real orgs for the free fixture and verifies the `6th` fails
- creates `20` real orgs for the Pro fixture and verifies the `21st` fails
- asserts the live backend returns `plan_limit_exceeded`

Default quota fixtures:

- free quota email: `quotafree@stefdevs.com`
- free quota username: `quotafree`
- Pro quota email: `quotapro@stefdevs.com`
- Pro quota username: `quotapro`

Password defaults:

- free quota password falls back to `SKILLMD_LOGIN_PASSWORD`
- Pro quota password falls back to `SKILLMD_PRO_LOGIN_PASSWORD`

Override those values in `~/.skillmd/.env` if needed.

## Replayable Team Quota Probe

To verify the live dev team limits end to end from the CLI repo:

```bash
cd /Users/azk/Desktop/workspace/skillmarkdown/cli
npm run e2e:team-quotas:dev
```

What it does:

- ensures the same dedicated free and Pro quota fixture users exist
- resets all of their organizations before the probe
- creates one free-owned org and verifies team creation is blocked with `forbidden_plan`
- creates one Pro-owned org, creates `5` real teams, and verifies the `6th` fails
- asserts the live backend returns `plan_limit_exceeded` for the Pro overflow

## Replayable Token Quota Probe

To verify the live dev token limits end to end from the CLI repo:

```bash
cd /Users/azk/Desktop/workspace/skillmarkdown/cli
npm run e2e:token-quotas:dev
```

What it does:

- ensures the same dedicated free and Pro quota fixture users exist
- resets their organizations and user tokens before the probe
- creates `20` real user tokens for the free fixture and verifies the `21st` fails
- creates `20` real user tokens for the Pro fixture and verifies the `21st` fails
- creates one Pro-owned org, creates `5` real org tokens, and verifies the `6th` fails
- asserts the live backend returns `plan_limit_exceeded` for both user and organization token overflow

## Search Contract Notes

The current early-access search contract is:

- web autocomplete uses `match=id`
- CLI public `search` uses `match=id`
- broader discovery/private search flows use `match=all`

Current canonical dev verification queries:

- after `npm run fixtures:dev:ensure`, private fixture search should succeed for `cursorseed`
- after `npm run seed:edge-cases:dev`, public registry search should succeed for `ed`

Do not treat `se` as a required public success probe in the current dev environment. The reset/reseed flow now rebuilds the public corpus around `edge-*`, so historical `se*` expectations are stale unless a dedicated `se*` fixture is added deliberately.

## Extended Sweep Note

`npm run e2e:extended` now reuses `npm run fixtures:dev:ensure` automatically for the shared base fixtures.

Extended strict coverage still needs two additional env-backed fixtures that are not created by the core bootstrap:

- `SKILLMD_E2E_ORG_MEMBER_USERNAME`
- `SKILLMD_E2E_ORG_SKILL_SLUG`

Those are specific to the extended org membership/team-assignment scenarios and still need to point at a real dev user and a real org-owned skill under `SKILLMD_E2E_ORG_SLUG`.

## Recommended `~/.skillmd/.env`

```dotenv
SKILLMD_FIREBASE_API_KEY=...
SKILLMD_FIREBASE_PROJECT_ID=skillmarkdown-development
SKILLMD_REGISTRY_BASE_URL=https://registryapi-sm46rm3rja-uc.a.run.app

SKILLMD_LOGIN_EMAIL=...
SKILLMD_LOGIN_PASSWORD=...
SKILLMD_PRO_LOGIN_EMAIL=...
SKILLMD_PRO_LOGIN_PASSWORD=...
SKILLMD_E2E_ORG_SLUG=...
```

## Scripts Using This Convention

- `scripts/command-sweep.mjs`
- `scripts/org-quota-probe.mjs`
- `scripts/team-quota-probe.mjs`
- `scripts/token-quota-probe.mjs`
- `scripts/publish-private-search-seed.mjs`
- `scripts/publish-test-skill-sequence.mjs`
- `scripts/publish-provider-batch.mjs`
- `scripts/publish-edge-case-skill-batch.mjs`
