# API root

`GET /v1/` (also accepted without the trailing slash) is public and returns
`200 OK` with `Content-Type: application/json; charset=utf-8`:

```json
{
  "name": "My Happy Wallet API",
  "version": "v1",
  "status": "ok",
  "health": {
    "live": "/health/live",
    "ready": "/health/ready"
  }
}
```

These fields are the complete response contract. `version` identifies the API
contract (`v1`), not the application release or its dependencies. If
`APP_BASE_URL` changes, this route follows that mount path; the health routes
remain at the paths shown above.

The response identifies the service without checking MySQL or Redis. Its
`status: "ok"` means the API root answered; it is not a readiness check. Use
`/health/ready` for dependency availability.

No credentials, internal configuration, user data, or documentation link are
returned. The same response is used with Swagger enabled or disabled.
`API_DOCS_ENABLED` continues to control `/api-docs` and the redirect from `/`:
when disabled, both remain `404`; when enabled, `/` redirects to `/api-docs`.

The health contracts are unchanged:

| Route               | HTTP status | JSON body                  | Dependencies                                       |
| ------------------- | ----------- | -------------------------- | -------------------------------------------------- |
| `GET /health/live`  | `200`       | `{"status":"ok"}`          | None                                               |
| `GET /health/ready` | `200`       | `{"status":"ok"}`          | Database and configured rate limit store available |
| `GET /health/ready` | `503`       | `{"status":"unavailable"}` | A dependency check failed                          |

Both health routes retain `Cache-Control: no-store` and never return dependency
error details.

## Verification

With the local backend running:

```bash
curl -i http://localhost:4200/v1/
curl -i http://localhost:4200/health/live
curl -i http://localhost:4200/health/ready
```

With test-only environment variables set as in the backend quality workflow,
run `npm run test:health`. The test covers the root's exact JSON contract with
Swagger on and off, both trailing-slash forms, and no dependency checks; it
also covers the existing health and Swagger behavior without a running database.

## Compatibility and rollback

Consumers parsing the old plain text must switch to JSON. No configuration,
dependency, or database migration is required. Reverting the change restores
the plain text response; no data rollback is needed.
