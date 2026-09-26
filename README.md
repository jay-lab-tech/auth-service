# Auth Service

REST API authentication service built with Express, TypeScript, PostgreSQL, Prisma, and Redis.

## Current status

Initial project scaffold. The health endpoint is the first setup checkpoint; authentication routes and persistence will be added in later milestones.

## Prerequisites

- Node.js 24 LTS
- PostgreSQL (Laragon is used for local development)
- Docker Desktop with the WSL 2 backend (for Redis during local development)

## Local setup

1. Copy `.env.example` to `.env` and set values for your local database and secrets.
2. Install packages with `npm install`.
3. Start the development server with `npm run dev`.
4. Open `http://localhost:3000/health` and expect `{"data":{"status":"ok"}}`.

Do not commit `.env` or real credentials.
