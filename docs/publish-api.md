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
  "channel": "latest",
  "digest": "sha256:...",
  "sizeBytes": 12345,
  "mediaType": "application/vnd.skillmarkdown.skill.v1+tar",
  "manifest": {
    "schemaVersion": "skillmd.publish.v1",
    "skill": "my-skill",
    "version": "1.0.0",
    "channel": "latest",
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
  "skillId": "@core/my-skill",
  "version": "1.0.0",
  "digest": "sha256:...",
  "channel": "latest"
}
```

`200` (upload required):

```json
{
  "status": "upload_required",
  "publishToken": "pub_xxx",
  "uploadUrl": "https://...",
  "uploadMethod": "PUT",
  "uploadHeaders": {
    "x-goog-meta-skill": "@core/my-skill"
  }
}
```

Error response shape:

```json
{
  "code": "version_conflict",
  "message": "Version already exists with different digest",
  "details": {
    "existingDigest": "sha256:..."
  }
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
  "publishToken": "pub_xxx"
}
```

Success response:

```json
{
  "status": "published",
  "skillId": "@core/my-skill",
  "version": "1.0.0",
  "digest": "sha256:...",
  "channel": "latest"
}
```

### Read endpoints (contract reference)

- `GET /v1/skills/{owner}/{skill}`
- `GET /v1/skills/{owner}/{skill}/versions/{version}`
- `GET /v1/skills/{owner}/{skill}/resolve?channel=latest|beta`
