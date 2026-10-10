# Changelog

Notable changes to this project are documented here. The format follows Keep a Changelog; versions are not considered released until tagged.

## [Unreleased]

### Added
- Express/TypeScript authentication API with registration, login, profile, refresh rotation, and logout.
- Admin user/role and audit-log endpoints with role-based access control.
- PostgreSQL persistence, Redis-backed login throttling, Docker Compose setup, OpenAPI/Swagger docs, and integration tests.

### Security
- Argon2id password hashes, hashed opaque refresh-token persistence, and replay-aware token-family revocation.
