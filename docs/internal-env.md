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

## Recommended `~/.skillmd/.env`

```dotenv
SKILLMD_FIREBASE_API_KEY=...
SKILLMD_FIREBASE_PROJECT_ID=skillmarkdown-development
SKILLMD_REGISTRY_BASE_URL=https://registry-development.skillmarkdown.com

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
