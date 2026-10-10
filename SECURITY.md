# Security Policy

## Reporting a vulnerability

Please do not disclose exploitable details in a public issue. Use GitHub's private vulnerability reporting for this repository if enabled; otherwise contact the repository maintainer privately through the GitHub profile. Include affected version/commit, impact, and reproducible steps. Do not include real user data or secrets.

## Implemented safeguards

- Argon2id password hashing; access tokens signed with HS256.
- Short-lived access JWTs and opaque refresh tokens; only SHA-256 refresh-token digests are persisted.
- Single-use refresh rotation, family revocation on replay, and explicit logout revocation.
- Redis login limiter (5/IP/15 minutes), failing closed with `503` if Redis is unavailable.
- Zod validation, JSON body limit, Helmet security headers, CORS middleware, and role checks.
- New accounts cannot self-select ADMIN; admin routes require a verified ADMIN claim.
- Prisma parameterization and relational constraints for persistence.

## Deployment responsibilities and limitations

This repository is not a hosted production identity service. Operators must use HTTPS, strong unique secrets (at least the configured minimum), private database/Redis networking, least-privilege credentials, backups, log/alert controls, and secret rotation. Configure trusted proxy behavior deliberately. Do not expose tokens, passwords, database URLs, or raw API logs publicly.

Email verification, password reset, MFA, OAuth/OIDC, session-device management, and automated expired-session cleanup are not provided. JWT-based downstream authorization can remain valid until access-token expiry after a role change or user deactivation; keep token lifetime short and account for that in consumers. Audit IP/user-agent metadata should be handled under an appropriate retention/privacy policy.

## Supported versions

Only the current repository state is maintained; no older release support window is currently published. Update Node.js and dependencies to supported security-patched releases and run the repository's test and audit checks before deployment.
