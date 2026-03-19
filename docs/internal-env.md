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
- org fixture slug: `huggingface`
- dev Firebase project: `skillmarkdown-development`
- dev registry base URL: `https://registryapi-sm46rm3rja-uc.a.run.app`

Current fixture note:

- `pro@stefdevs.com` is provisioned and valid for login, but the account currently reports plan `free`, not `pro`
- strict `e2e:core` therefore treats private-Pro checks as conditional coverage unless that fixture is upgraded
- keep passwords and API keys only in local `~/.skillmd/.env`, not in repo-tracked docs

Keep passwords and live secrets in local `~/.skillmd/.env`, not in repo-tracked docs.

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
