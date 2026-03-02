# History API Contract (v1)

This document defines the HTTP contract consumed by `skillmd history`.

## Endpoint

### `GET /v1/skills/{owner}/{skill}/versions`

Query params:

- `limit` (optional): integer `1..50` (default `20`)
- `cursor` (optional): opaque pagination cursor

Success response:

```json
{
  "owner": "@core",
  "ownerLogin": "core",
  "skill": "my-skill",
  "limit": 20,
  "results": [
    {
      "version": "1.2.3",
      "digest": "sha256:...",
      "sizeBytes": 12345,
      "mediaType": "application/vnd.skillmarkdown.skill.v1+tar",
      "publishedAt": "2026-03-01T12:00:00Z",
      "yanked": false,
      "yankedAt": null,
      "yankedReason": null
    }
  ],
  "nextCursor": "opaque_or_null"
}
```

Error envelope:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Human-readable explanation",
    "details": {}
  },
  "requestId": "req_..."
}
```
