# Publish Registry Model (v1)

This document defines the registry data and artifact model for `skillmd publish` v1.

## Scope

- Public-read registry metadata/artifacts
- Authenticated writes via Firebase ID token
- Immutable semver versions backed by content digests
- No hard delete; versions may be yanked in backend policy

## Canonical identifiers

- Skill id: `owner/skill`
- Version: semver (`1.2.3`, `1.2.3-beta.1`)
- Artifact digest: `sha256:<hex>`

## Firestore shape

- `owners/{ownerSlug}`
- `skills/{ownerSlug}__{skillSlug}`
- `skills/{ownerSlug}__{skillSlug}/versions/{version}`

`owners/{ownerSlug}` fields:

- `ownerSlug`
- `ownerUid`
- `createdAt`
- `updatedAt`

`skills/{ownerSlug}__{skillSlug}` fields:

- `ownerSlug`
- `skillSlug`
- `description`
- `visibility` (`public`)
- `channels.latest` (optional semver)
- `channels.beta` (optional semver)
- `createdAt`
- `updatedAt`

`versions/{version}` fields:

- `version`
- `digest`
- `sizeBytes`
- `objectPath`
- `manifestPath`
- `publishedByUid`
- `publishedByEmail` (optional)
- `publishedAt`
- `yanked` (bool)
- `yankedAt` (optional)
- `yankedReason` (optional)

## Storage shape

- `skills/{ownerSlug}/{skillSlug}/{version}/{digest}.tgz`
- `skills/{ownerSlug}/{skillSlug}/{version}/manifest.json`

## Ownership rule

- First authenticated publisher to use an `ownerSlug` claims that owner namespace.
- Later publishes under that owner slug must come from the same owner uid.

## Immutability / idempotency

- `owner/skill@version` is immutable once committed.
- Publish is idempotent when existing version has the same digest.
- Publish fails with conflict when existing version has a different digest.

## Visibility

- Read endpoints are public.
- Write endpoints require authenticated Firebase ID token.
