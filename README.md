# Auth Service

A REST API authentication service built with Express 5, TypeScript, PostgreSQL, Prisma, and Redis. It demonstrates password hashing, short-lived JWT access tokens, opaque rotating refresh tokens, role-based authorization, login rate limiting, and authentication audit logs.

## Features

- User registration and login with Argon2id password hashing.
- 15-minute HS256 access JWTs and seven-day, single-use refresh tokens. Only SHA-256 hashes of refresh tokens are stored.
- Refresh-token rotation and token-family revocation when a previously used token is replayed.
- Redis-backed login limit: five attempts per IP per 15-minute window. The login endpoint fails closed if Redis is unavailable.
- Authenticated profile and logout endpoints; admin-only user listing, role changes, and audit-log access.
- Zod request validation, Helmet headers, consistent errors, PostgreSQL/Redis health check, and Docker Compose.

## Requirements

- Node.js 24 or newer
- PostgreSQL 16 (local development can use Laragon)
- Redis 7 (Docker is convenient for local development)
- Docker Desktop with Compose, if using the all-in-Docker setup

## Local development (Laragon PostgreSQL)

1. Start PostgreSQL in Laragon and ensure the `auth_service` database exists. Start Redis (for example, the existing `auth-redis` container on port `6379`).
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to match your local PostgreSQL credentials and set `JWT_ACCESS_SECRET` to a unique random value of at least 32 characters. Never use the sample secret outside local development.
3. Install and generate Prisma Client:

   ```sh
   npm ci
   npm run db:generate
   npm run db:migrate
   ```

4. Start the API:

   ```sh
   npm run dev
   ```

5. Check `http://localhost:3000/health`; healthy dependencies return `postgres: "ok"` and `redis: "ok"`.

## Docker Compose

Compose starts the API, PostgreSQL, and Redis together. Its host ports default to API `3000`, PostgreSQL `5433`, and Redis `6380` so the database and Redis instances used by Laragon/current development do not conflict. Inside Compose, the API uses the internal service names.

Copy `.env.example` to `.env`, replace `JWT_ACCESS_SECRET` with a unique random secret (at least 32 characters), then run:

```sh
docker compose up --build
```

The app waits for healthy database and Redis containers, applies committed migrations, and starts. To stop containers while keeping database data, run `docker compose down`. `docker compose down -v` deletes the Compose PostgreSQL volume and all data in that volume; do not use it unless you intend to erase that database.

## API

All successful responses use a `data` field. Errors use `error.code` and `error.message`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | PostgreSQL and Redis readiness |
| `POST` | `/api/auth/register` | No | Create a user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | No | Sign in; returns user, access token, and refresh token |
| `POST` | `/api/auth/refresh` | No | Rotate a refresh token (`refreshToken`) |
| `POST` | `/api/auth/logout` | Bearer | Revoke the supplied refresh token (`refreshToken`) |
| `GET` | `/api/auth/me` | Bearer | Current user profile |
| `GET` | `/api/users?page=1&limit=20` | Admin | Paginated user listing |
| `PATCH` | `/api/users/:id/role` | Admin | Set `{ "role": "USER" }` or `{ "role": "ADMIN" }` |
| `GET` | `/api/audit-logs?page=1&limit=20` | Admin | Paginated audit events |

Send protected requests with `Authorization: Bearer <accessToken>`. Keep both tokens secret. Refresh tokens are single-use: save the newly returned refresh token each time `/refresh` succeeds. Reuse of an old token revokes active sessions in that token family.

New registrations always receive the `USER` role. For local development, create an admin by changing a user's role directly in the local database; do not add a public admin-registration endpoint.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

`npm test` is an integration test and requires a migrated PostgreSQL database and reachable Redis configured in `.env`. It creates a uniquely named temporary user and deletes it after the test.

## Security notes

- `.env` and real credentials must never be committed. Rotate any secret or token that has been exposed.
- The Compose PostgreSQL credentials are intended only for local development. Set strong credentials and network restrictions before any public deployment.
- Access tokens embed the role but protected requests also load the current account state/role from PostgreSQL, so role changes and deactivation take effect promptly.
- Login rate limiting uses the client IP seen by Express. If deployed behind a reverse proxy, configure trusted proxy addresses deliberately; do not blindly trust arbitrary forwarded headers.
- Prisma 7.10 currently pins vulnerable versions of two CLI dependencies, so `package.json` overrides them to patched `deepmerge-ts@8.0.1` and `mysql2@3.23.1`. `npm audit` is clean with these overrides; rerun Prisma generation/migration tests when upgrading Prisma, and remove the overrides after upstream pins are fixed.
- Before production use, add TLS, operational secret management, monitoring/backups, and a deployment-specific review of the threat model.

## License

No license has been selected yet. Add a `LICENSE` file before inviting external reuse.
