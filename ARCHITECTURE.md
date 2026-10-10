# Architecture

## Request and dependency flow

```text
Client
  └─ Express 5: Helmet → CORS → JSON validation → route/controller
       ├─ Auth/RBAC middleware ── verifies HS256 access JWT
       ├─ Auth services ───────── Argon2id + token/session operations
       ├─ Prisma ──────────────── PostgreSQL (users, refresh sessions, audit)
       └─ Login limiter ──────── Redis (atomic IP counter)
```

`GET /health` checks PostgreSQL and Redis and returns `503` if either dependency is unavailable. Swagger UI and the OpenAPI contract are served under `/docs`.

## Layers

- **HTTP boundary:** Express routers map endpoints to controllers. Zod strict schemas validate request bodies; validation, not-found, and unexpected errors use a consistent error envelope.
- **Controllers and services:** controllers translate HTTP input/output; auth services implement account and session lifecycle rules.
- **Persistence:** Prisma models `User`, `RefreshSession`, and `AuditLog`. Refresh-token plaintext is not persisted: only SHA-256 hashes are stored. `familyId` and `replacedBy` support rotation and replay detection.
- **Infrastructure:** PostgreSQL is the durable store; Redis backs the login limiter. Docker Compose runs the API and dependencies.

## Session lifecycle

Login verifies an Argon2id password, creates a 15-minute HS256 access JWT and a random opaque refresh token valid for seven days. Refresh atomically consumes the old session and issues a replacement. Reuse of a consumed token is treated as replay and revokes the active token family. Logout requires a valid access JWT and revokes the submitted refresh session.

## Data model

```text
User 1 ── * RefreshSession
User 1 ── * AuditLog (audit user is nullable; deleting a user preserves the log)

User: id, email (unique), passwordHash, name, role, isActive, timestamps
RefreshSession: userId, tokenHash (unique), familyId, expiry/revocation/replacement,
                IP, user-agent, createdAt
AuditLog: nullable userId, action, status, IP, user-agent, createdAt
```

Roles are `USER` and `ADMIN`; public registration always creates `USER`. Admin role changes are guarded by both authentication and RBAC middleware.

## Key decisions and trade-offs

- **Opaque rotating refresh tokens** make revocation and replay detection possible, at the cost of a database lookup on refresh.
- **Shared HS256 secret** allows the portfolio's E-Commerce API and URL Shortener to verify access tokens without duplicating users. All verifiers must use the same secret, issuer, and audience; compromise of that secret affects every verifier.
- **Redis-backed login limiting fails closed:** inability to reach Redis returns `503`, preventing an unthrottled login path but reducing availability during Redis outages.
- **Audit data is relational** for queryability; IP address and user-agent still count as potentially sensitive metadata.

## Out of scope

This is a REST auth service, not an OAuth/OIDC provider. Email verification, password recovery, MFA, and external identity providers are not implemented.
