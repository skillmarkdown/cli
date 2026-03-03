# Use API Contract (v1)

This document defines the HTTP contracts consumed by `skillmd use` and `skillmd install`.

## Resolve endpoint

### `GET /v1/skills/{owner}/{skill}/resolve?spec=<tag|version|range>`

Used when `--version` is not explicitly provided.

Expected success fields:

- `owner`
- `ownerLogin`
- `skill`
- `spec`
- `version`
- `agentTarget` (optional)
- `deprecated` (boolean)
- `deprecatedAt` (optional)
- `deprecatedMessage` (optional)

`spec` defaults to `latest` when omitted.

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
- `deprecated`
- `deprecatedAt`
- `deprecatedMessage`
- `downloadUrl`
- `downloadExpiresAt`

`downloadUrl` is then used by the CLI for direct artifact byte download, followed by local integrity verification.
