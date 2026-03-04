# Security Model

This document describes the security architecture of the `skillmd` CLI and its trust relationship with the Skillmarkdown registry backend.

## Recent Hardening

- Session storage hardening:
  - auth directory created with `0o700`
  - session file enforced as `0o600`
- Security regression coverage:
  - owner derivation tests
  - session permission and session parsing tests
  - publish integrity and replay-oriented behavior tests
  - token/session validation tests
- Canonical reference:
  - security updates are tracked in this document (no separate updates file)

## Trust Boundaries

### CLI Trust Model

- **CLI is untrusted for identity assertions** — Owner identity must be verified server-side
- **Backend trusts only verified bearer tokens** — Firebase ID tokens or automation tokens
- **Owner identity for write operations** — Derived from Firebase GitHub provider claims, not client-supplied values
- **Session storage** — Local file with restricted permissions (`0o600`)

### Registry Trust Model

- **Server-side owner derivation** — Backend extracts GitHub identity from Firebase token claims
- **Fallback to stored identity** — If login claims are missing, backend uses previously synced `users/{uid}` record
- **Artifact integrity** — Verified server-side after upload (size + SHA-256 digest)
- **Signed URLs** — Short-lived, scoped to single object path, upload-only (not publish finalization)

## Authentication

### Token Types

| Type              | Format                                                | Storage                | Use Case                 |
| ----------------- | ----------------------------------------------------- | ---------------------- | ------------------------ |
| Firebase ID Token | JWT (short-lived)                                     | Not stored             | Interactive CLI sessions |
| Refresh Token     | Opaque                                                | `~/.skillmd/auth.json` | Session persistence      |
| Automation Token  | `skmd_live_<id>.<secret>` or `skmd_dev_<id>.<secret>` | User-managed env var   | CI/CD, scripts           |

### Token Scopes

| Scope     | Capabilities                                          |
| --------- | ----------------------------------------------------- |
| `read`    | Read public skills, read owned private skills, search |
| `publish` | `read` + publish skills, manage dist-tags             |
| `admin`   | `publish` + deprecate, unpublish, token management    |

### Auth Flow (Interactive)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   skillmd   │────▶│   GitHub     │────▶│   Firebase  │────▶│   Registry   │
│    CLI      │     │   OAuth      │     │   Auth      │     │   Backend    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
     │                      │                    │                    │
     │  1. skillmd login    │                    │                    │
     │─────────────────────▶│                    │                    │
     │                      │  2. Device flow    │                    │
     │                      │───────────────────▶│                    │
     │                      │                    │                    │
     │                      │  3. User approves  │                    │
     │                      │◀───────────────────│                    │
     │                      │                    │                    │
     │  4. ID + Refresh     │                    │                    │
     │◀─────────────────────│                    │                    │
     │                      │                    │                    │
     │  5. Exchange refresh │                    │                    │
     │──────────────────────────────────────────▶│                    │
     │                      │                    │                    │
     │  6. Firebase ID Token│                    │                    │
     │◀──────────────────────────────────────────│                    │
     │                      │                    │                    │
     │  7. Publish with ID Token                 │                    │
     │───────────────────────────────────────────────────────────────▶│
     │                      │                    │                    │
```

### Auth Flow (Automation Token)

```
┌─────────────┐     ┌──────────────┐
│   CI/CD     │────▶│   Registry   │
│   Script    │     │   Backend    │
└─────────────┘     └──────────────┘
     │                      │
     │  1. Set SKILLMD_AUTH_TOKEN=skmd_live_...
     │                      │
     │  2. Publish with token
     │─────────────────────▶│
     │                      │
     │  3. Verify: prefix, hash, expiry, scope
     │◀─────────────────────│
     │                      │
```

## Session Storage

### Location

```
~/.skillmd/auth.json
```

### Permissions

- **File**: `0o600` (owner read/write only)
- **Directory**: `0o700` (owner access only)

### Contents

```json
{
  "provider": "github",
  "uid": "firebase-uid-here",
  "githubUsername": "your-username",
  "email": "you@example.com",
  "refreshToken": "encrypted-refresh-token",
  "projectId": "skillmarkdown-development"
}
```

### Security Properties

- Refresh tokens are stored as-is (Firebase encrypts at rest)
- File is created with restrictive permissions
- Directory is created with restrictive permissions
- No automation token secrets are ever stored

## Authorization

### Policy Enforcement

All write operations pass through centralized policy check (`can()` function):

1. **Scope check** — Does the token have required scope?
2. **Ownership check** — Is the caller the resource owner?
3. **Entitlement check** — Does the user's plan allow this operation?

### Ownership Rules

| Resource Type    | Owner Determination                         |
| ---------------- | ------------------------------------------- |
| User-owned skill | `ownerUid` matches token `uid`              |
| Team-owned skill | Caller is team member with appropriate role |

### Plan Entitlements

| Plan    | Private Skills | Publish Private |
| ------- | -------------- | --------------- |
| `free`  | ❌             | ❌              |
| `pro`   | ✅             | ✅              |
| `teams` | ✅             | ✅              |

## Publish Security

### Three-Phase Publish

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   PREPARE        │────▶│   UPLOAD         │────▶│   COMMIT         │
└──────────────────┘     └──────────────────┘     └──────────────────┘
       │                        │                        │
       │ 1. Auth check          │                        │
       │ 2. Scope check         │                        │
       │ 3. Ownership check     │                        │
       │ 4. Create intent       │                        │
       │ 5. Return signed URL   │                        │
       │                        │ 6. Upload to GCS       │
       │                        │    (no auth needed)    │
       │                        │                        │ 7. Auth check
       │                        │                        │ 8. Verify intent
       │                        │                        │ 9. Verify digest
       │                        │                        │ 10. Verify size
       │                        │                        │ 11. Mark consumed
       │                        │                        │ 12. Create version
```

### Integrity Verification

On `commit`, backend verifies:

1. **Object exists** — Storage object at expected path
2. **Size matches** — `sizeBytes` from prepare matches actual
3. **Digest matches** — SHA-256 hash matches expected value
4. **Intent not consumed** — Publish intent is single-use
5. **Intent not expired** — TTL default ~15 minutes
6. **Caller UID matches** — Same user who prepared

### Replay Prevention

| Attack                   | Prevention                                    |
| ------------------------ | --------------------------------------------- |
| Reuse publish intent     | Intent marked `consumed` after first commit   |
| Replay by different user | Commit verifies caller UID matches intent UID |
| Expired intent replay    | Intent expiry checked on commit               |
| Upload without commit    | Upload URL doesn't finalize publish           |

## Automation Tokens

### Token Structure

```
skmd_<env>_<tokenId>.<secret>
    │       │         │
    │       │         └─ 16-64 char secret (never stored)
    │       └─────────── Token identifier (stored)
    └─────────────────── Environment prefix
```

### Storage

- **Token ID**: Stored in Firestore (`users/{uid}/tokens/{tokenId}`)
- **Token Hash**: `SHA256(pepper:secret)` — secret is never stored
- **Pepper**: `SKILLMD_TOKEN_HASH_PEPPER` env var (required in prod)

### Verification

```typescript
// 1. Parse token
const { prefix, tokenId, secret } = parse(tokenString);

// 2. Lookup by tokenId
const stored = await db.doc(`users/${uid}/tokens/${tokenId}`).get();

// 3. Verify hash (timing-safe)
const expectedHash = SHA256(pepper + ":" + secret);
timingSafeEqual(expectedHash, stored.tokenHash);

// 4. Check expiry and revocation
if (expired || revoked) throw "unauthorized";
```

### Token Lifecycle

| Operation    | Scope Required |
| ------------ | -------------- |
| List tokens  | `admin`        |
| Create token | `admin`        |
| Revoke token | `admin`        |

### Best Practices

1. **Use short expiry** — 30-90 days for CI tokens
2. **Scope minimally** — Use `publish` scope, not `admin`, unless needed
3. **Rotate regularly** — Revoke and recreate tokens periodically
4. **Protect in CI** — Store as secret, never log or echo

## Rate Limiting

### Route Classes

| Route Class       | IP Limit           | Principal Limit     |
| ----------------- | ------------------ | ------------------- |
| `publish_prepare` | 30/min             | 30/min              |
| `publish_commit`  | 30/min             | 30/min              |
| `dist_tag_write`  | 60/min             | 60/min              |
| `deprecate`       | 20/min             | 20/min              |
| `unpublish`       | 10/min             | 10/min              |
| `token_create`    | 10/min             | 10/min              |
| `search`          | 40/min (burst 80)  | 60/min (burst 120)  |
| `public_read`     | 60/min (burst 120) | 120/min (burst 240) |

### Throttle Response

```json
{
  "error": {
    "code": "invalid_request",
    "message": "rate limit exceeded",
    "details": {
      "retryAfterSeconds": 45
    }
  }
}
```

Headers:

- `RateLimit-Limit`: Request limit
- `RateLimit-Remaining`: Remaining requests
- `RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait (when denied)

## Audit Logging

### Logged Fields (Write Operations)

| Field         | Description                      |
| ------------- | -------------------------------- |
| `requestId`   | Unique request identifier        |
| `uid`         | User ID from auth token          |
| `ownerSlug`   | Owner slug (e.g., `@username`)   |
| `ownerHandle` | Owner handle (e.g., `@username`) |
| `skillSlug`   | Skill name                       |
| `version`     | Version string                   |
| `outcome`     | Success/failure                  |
| `error.code`  | Error code if failed             |

### Not Logged

- Raw auth tokens
- Token secrets
- Refresh tokens
- Full request bodies (only structured fields)

## Security Checklist

### Before Publishing a Skill

- [ ] Validate skill with `skillmd validate --strict`
- [ ] Review SKILL.md for sensitive data
- [ ] Ensure no secrets in artifact (`.gitignore`d files)
- [ ] Use `--dry-run` to preview publish manifest

### Before Using Automation Tokens

- [ ] Token has minimal required scope
- [ ] Token has reasonable expiry (≤90 days)
- [ ] Token stored securely (CI secrets, not env file)
- [ ] Token not logged or echoed in CI output

### After Security Incident

- [ ] Revoke all automation tokens: `skillmd token ls` then `skillmd token rm <id>`
- [ ] Clear local session: `rm ~/.skillmd/auth.json`
- [ ] Re-authenticate: `skillmd login --reauth`
- [ ] Review audit logs (contact registry admin)

## Vulnerability Disclosure

### Reporting

If you discover a security vulnerability:

1. **Do not** create a public GitHub issue
2. **Email**: security@skillmarkdown.com (PGP key available on request)
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity (critical: 24-72 hours)

### Scope

**In scope**:

- CLI authentication bypass
- Token scope escalation
- Owner impersonation
- Artifact tampering
- Rate limit bypass
- Replay attacks

**Out of scope**:

- Denial of service (unless bypassing rate limits)
- Vulnerabilities in Firebase or GitHub OAuth
- Social engineering attacks

## Security Updates

Security advisories are published:

- GitHub Security Advisories: https://github.com/skillmarkdown/cli/security/advisories
- npm security advisories: https://www.npmjs.com/package/@skillmarkdown/cli?activeTab=security

To receive updates:

1. Watch the repository (GitHub)
2. Enable security alerts for your projects

---

**Last updated**: 2026-03-04  
**Version**: 1.0.0
