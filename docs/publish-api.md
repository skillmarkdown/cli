# Publish API Contract (v1)

This document defines the HTTP contract consumed by `skillmd publish`.

Owner namespace is derived server-side from authenticated GitHub identity and normalized to `@githubusername`.

## Auth

Write endpoints require:

- `Authorization: Bearer <firebase-id-token>`

## Endpoints

### `POST /v1/publish/prepare`

Purpose:

- reserve publish intent
- return signed upload URL when upload is required
- support idempotent responses

Request body:

```json
{
  "skill": "my-skill",
  "version": "1.0.0",
  "tag": "latest",
  "access": "public",
  "provenance": false,
  "packageMeta": {
    "name": "my-skill",
    "version": "1.0.0",
    "description": "Example skill"
  },
  "agentTarget": "skillmd",
  "digest": "sha256:...",
  "sizeBytes": 12345,
  "mediaType": "application/vnd.skillmarkdown.skill.v1+tar",
  "manifest": {
    "schemaVersion": "skillmd.publish.v1",
    "skill": "my-skill",
    "version": "1.0.0",
    "digest": "sha256:...",
    "sizeBytes": 12345,
    "mediaType": "application/vnd.skillmarkdown.skill.v1+tar",
    "files": []
  }
}
```

Success responses:

`200` (idempotent):

```json
{
  "status": "idempotent",
  "publishToken": "pit_xxx",
  "expiresAt": "2026-03-01T12:00:00Z"
}
```

`200` (upload required):

```json
{
  "status": "upload_required",
  "publishToken": "pit_xxx",
  "uploadUrl": "https://...",
  "uploadHeaders": {
    "content-type": "application/vnd.skillmarkdown.skill.v1+tar"
  },
  "expiresAt": "2026-03-01T12:00:00Z"
}
```

Error response shape:

```json
{
  "error": {
    "code": "version_conflict",
    "message": "Version already exists with different digest",
    "details": {
      "existingDigest": "sha256:..."
    }
  },
  "requestId": "req_..."
}
```

Known error codes:

- `unauthorized`
- `forbidden`
- `invalid_request`
- `version_conflict`
- `artifact_too_large`

### `POST /v1/publish/commit`

Purpose:

- finalize publish after artifact upload

Request body:

```json
{
  "publishToken": "pit_xxx"
}
```

Success response:

```json
{
  "status": "published",
  "skillId": "@core/my-skill",
  "version": "1.0.0",
  "tag": "latest",
  "distTags": {
    "latest": "1.0.0"
  },
  "agentTarget": "skillmd",
  "provenance": {
    "requested": false,
    "recorded": false
  }
}
```

### Read endpoints (contract reference)

- `GET /v1/skills/{owner}/{skill}`
- `GET /v1/skills/{owner}/{skill}/versions/{version}`
- `GET /v1/skills/{owner}/{skill}/resolve?spec=<tag|version|range>`
