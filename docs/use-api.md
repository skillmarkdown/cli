# Use API Contract (v1)

This document defines the HTTP contracts consumed by `skillmd use`.

## Resolve endpoint

### `GET /v1/skills/{owner}/{skill}/resolve?channel=latest|beta`

Used when `--version` is not explicitly provided.

Expected success fields:

- `owner`
- `ownerLogin`
- `skill`
- `channel`
- `version`

## Artifact descriptor endpoint

### `GET /v1/skills/{owner}/{skill}/versions/{version}/artifact`

Expected success fields:

- `owner`
- `ownerLogin`
- `skill`
- `version`
- `digest`
- `sizeBytes`
- `mediaType`
- `yanked`
- `yankedAt`
- `yankedReason`
- `downloadUrl`
- `downloadExpiresAt`

`downloadUrl` is then used by the CLI for a direct artifact byte download, followed by local integrity verification.
