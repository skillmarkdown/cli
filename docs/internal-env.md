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
- `scripts/publish-private-search-seed.mjs`
- `scripts/publish-test-skill-sequence.mjs`
- `scripts/publish-provider-batch.mjs`
- `scripts/publish-edge-case-skill-batch.mjs`
