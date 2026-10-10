# API Reference

Local base URL: `http://localhost:3000`. Interactive docs: `/docs`; OpenAPI: [`docs/openapi.yaml`](docs/openapi.yaml).

## Conventions

JSON requests use `Content-Type: application/json`. Successful responses generally wrap payloads in `data`; errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`. Authenticated routes require `Authorization: Bearer <accessToken>`. Admin routes additionally require role `ADMIN`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /health` | Public | PostgreSQL and Redis readiness |
| `POST /api/auth/register` | Public | Create a USER account |
| `POST /api/auth/login` | Public; limited | Issue access and refresh tokens |
| `POST /api/auth/refresh` | Public | Rotate refresh token |
| `POST /api/auth/logout` | Bearer | Revoke supplied refresh token |
| `GET /api/auth/me` | Bearer | Current user profile |
| `GET /api/users?page=1&limit=20` | Admin | Paginated user list |
| `PATCH /api/users/:id/role` | Admin | Change a user's role |
| `GET /api/audit-logs?page=1&limit=20` | Admin | Paginated audit events |

## Endpoints

### `POST /api/auth/register`

Request: `{ "name": "Demo User", "email": "demo@example.com", "password": "AtLeast12Characters" }`. Name is 2–80 chars; password 12–128 chars. Email is trimmed and lowercased. Returns `201` with `{data:{id,name,email,role,isActive,createdAt,updatedAt}}`; role is always `USER`. Errors: `400` invalid input, `409` email already registered.

### `POST /api/auth/login`

Request: `{ "email": "demo@example.com", "password": "..." }`. Returns `200` with `{data:{user:{id,name,email,role,...},accessToken,refreshToken}}`. Access JWT lifetime is 15 minutes; opaque refresh token lifetime is seven days. Invalid credentials return `401`; after five requests from an IP in the 15-minute limiter window, response is `429` with `Retry-After`; Redis failure returns `503`.

### `POST /api/auth/refresh`

Request: `{ "refreshToken": "<opaque-token>" }`. Returns the same token response shape as login with a new refresh token. The old token is single-use. Invalid, expired, revoked, or replayed tokens return `401`.

### `POST /api/auth/logout`

Requires Bearer access token. Request body: `{ "refreshToken": "<opaque-token>" }`. Returns success after revocation; the token must belong to the authenticated user. Invalid access/token state returns `401`.

### `GET /api/auth/me`

Requires Bearer token. Returns `{data:{id,name,email,role,isActive,createdAt,updatedAt}}`. Invalid/expired token: `401`.

### Admin endpoints

- `GET /api/users?page=1&limit=20`: returns a paginated list (limit 1–100, default 20). Requires ADMIN; invalid pagination `400`, missing/invalid auth `401`, non-admin `403`.
- `PATCH /api/users/:id/role`: JSON `{ "role": "USER" | "ADMIN" }`; returns updated user. Invalid UUID/body `400`, unknown user `404`, auth errors `401`/`403`.
- `GET /api/audit-logs?page=1&limit=20`: paginated audit entries; same access and pagination rules as user listing.

## General status codes

`400` invalid input; `401` invalid credentials/token; `403` insufficient role; `404` route/resource absent; `409` uniqueness conflict; `429` login limit; `503` required dependency unavailable. For exact schemas consult the OpenAPI contract.
