# Search API Contract (v1)

This document defines the HTTP contract consumed by `skillmd search`.

## Endpoint

### `GET /v1/skills/search`

Query params:

- `q` (optional): single search token
- `limit` (optional): integer `1..50` (default `20`)
- `cursor` (optional): opaque pagination cursor

Success response:

```json
{
  "query": "agent",
  "limit": 20,
  "results": [
    {
      "skillId": "@core/my-skill",
      "owner": "@core",
      "ownerLogin": "core",
      "skill": "my-skill",
      "description": "Optional summary",
      "channels": {
        "latest": "1.2.3",
        "beta": "1.3.0-beta.1"
      },
      "updatedAt": "2026-03-01T12:00:00Z"
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
