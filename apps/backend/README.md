# Backend (NestJS + Prisma + PostgreSQL)

## Quick Start (Recommended: PostgreSQL)

1. Copy env:
   - `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`)
2. Keep `DATA_SOURCE=prisma` in `.env`
   - `DATABASE_URL` must be set when using `DATA_SOURCE=prisma`.
3. Start PostgreSQL:
   - `docker compose up -d`
4. Install dependencies:
   - `npm install`
5. Generate Prisma client:
   - `npm run db:generate --workspace backend`
6. Run migration:
   - `npm run db:migrate --workspace backend`
7. Seed sample data:
   - `npm run db:seed --workspace backend`
   - Requires `DEV_AUTH_SUPERADMIN_PASSWORD` and `DEV_AUTH_ADMIN_PASSWORD` in `.env`.
   - By default this is non-destructive and only seeds missing defaults (including auth users).
   - To reset and reseed explicitly:
     - macOS/Linux: `SEED_RESET=true npm run db:seed --workspace backend`
     - PowerShell: `$env:SEED_RESET="true"; npm run db:seed --workspace backend`
8. Start backend:
   - `npm run dev:backend`
9. Open API docs:
   - `http://localhost:3001/api/docs`

## Production Env Template

- Use `env.production.example` as production reference.
- Recommended flow:
  1. Copy `env.production.example` to `.env` on production host.
  2. Set real `DATABASE_URL`, `AUTH_SECRET`, and `CORS_ORIGINS`.
  3. Keep `TRUST_PROXY=false` unless requests really come through a trusted reverse proxy.
  4. Keep `AUTH_BOOTSTRAP_DEFAULT_USERS=false` in production.
  5. Keep runtime cleanup enabled unless you intentionally externalize retention management.

## Initial Production Super Admin

- Production does not auto-create default auth users.
- `AUTH_BOOTSTRAP_DEFAULT_USERS=true` is rejected in production.
- Prisma seed also refuses to run in production.
- For a fresh production database, create the first super-admin manually with:
  - `npm run auth:bootstrap:superadmin -- --name "Owner" --email "owner@example.com" --password "StrongPassword#2026"`
- The command only succeeds when the `AuthUser` table is still empty.
- If `--username` is omitted, the username is derived from the email local-part.

## Quick Start (Fallback: Memory Mode)

1. Copy env:
   - `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`)
2. Set `DATA_SOURCE=memory` in `.env`
3. Install dependencies:
   - `npm install`
4. Start backend:
   - `npm run dev:backend`

## Test Commands

- Unit tests (fast, mostly memory/in-process):
  - `npm run test:unit --workspace backend`
- Default `npm run test --workspace backend` is now unit-test focused.
- Prisma integration test (real database required):
  - `npm run test:integration --workspace backend`
- API e2e test (memory mode):
  - `npm run test:api --workspace backend`
- Vitest + Supertest smoke/API docs test:
  - `npm run test:vitest --workspace backend`

## Runtime Validation

- Runtime env sekarang dimuat via `@nestjs/config` dan divalidasi terpusat dengan `joi`.
- `PORT` must be a numeric value between `1` and `65535`.
- `DATA_SOURCE` must be either `memory` or `prisma`.
- `DATA_SOURCE=prisma` is mandatory in production (`NODE_ENV=production`).
- `DATABASE_URL` is required when `DATA_SOURCE=prisma`.
- `AUTH_SECRET` is required in production and should be a private random value.
- `CORS_ORIGINS` is required in production and must use explicit origins.
- `TRUST_PROXY` should stay `false` unless proxy headers are sanitized by trusted infrastructure.
- `LOG_LEVEL` defaults to `warn` in non-production and `info` in production.
- `HTTP_LOG_SUCCESS` controls whether successful HTTP requests are printed.
  - Defaults to `false` in non-production to keep the terminal quieter.
  - Defaults to `true` in production.
- `AUTH_BOOTSTRAP_DEFAULT_USERS` controls auto-creation of default auth users on startup in Prisma mode.
  - Defaults to `false` until explicitly set to `true`.
  - Requires `DEV_AUTH_SUPERADMIN_PASSWORD` and `DEV_AUTH_ADMIN_PASSWORD` when enabled.
- Global API throttling is controlled by:
  - `THROTTLE_DEFAULT_TTL_MS`
  - `THROTTLE_DEFAULT_LIMIT`
  - `THROTTLE_DEFAULT_BLOCK_MS`
- Runtime retention cleanup is controlled by:
  - `RUNTIME_RETENTION_ENABLED`
  - `RUNTIME_RETENTION_INTERVAL_MS`
  - `GROUP_AUDIT_LOG_RETENTION_DAYS`
  - `AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS`
  - `APP_THROTTLE_BUCKET_RETENTION_DAYS`
- Development login password defaults can be overridden by:
  - `DEV_AUTH_SUPERADMIN_PASSWORD`
  - `DEV_AUTH_ADMIN_PASSWORD`

## Security Defaults

- `helmet` is enabled globally for HTTP security headers.
- `Permissions-Policy` is set explicitly for camera, geolocation, and microphone restrictions.
- `@nestjs/throttler` is enabled globally for API-wide rate limiting.
- `/api/health` skips global throttling to stay friendly for liveness/readiness probes.
- Successful HTTP requests are muted by default in non-production; warnings and errors still appear.
- HTTP logs are sanitized to keep request/response metadata minimal and avoid leaking headers or cookies.
- Development logs are rendered as concise single-line summaries so method, path, status, and duration stay readable without flooding the terminal.
- API errors now use a consistent JSON envelope with `ok`, `statusCode`, `error`, `message`, `path`, `timestamp`, and `requestId`.
- Stale runtime rows such as audit logs and rate-limit buckets are cleaned on an interval in Prisma mode.

## Development Login Accounts

- Super Admin
  - Identifier: `dev.superadmin`
  - Password default: `DevSuperAdmin#2026`
- Admin
  - Identifier: `dev.admin`
  - Password default: `DevAdmin#2026`
- Identifier bisa pakai username atau email:
  - `superadmin.dev@ghaniya.local`
  - `admin.dev@ghaniya.local`
- Akun default ini disimpan di tabel `AuthUser` via seed atau bootstrap Prisma yang diaktifkan eksplisit.

## API Base URL

- `http://localhost:3001/api`
- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs/json`

## Initial Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/users`
- `POST /api/auth/users`
- `PATCH /api/auth/users/:userId`
- `PUT /api/auth/users/:userId/password`
- `GET /api/auth/session`
- `GET /api/auth/users`
- `POST /api/auth/users`
- `PATCH /api/auth/users/:userId`
- `DELETE /api/auth/users/:userId`
- `GET /api/groups`
  - supports optional query param: `GET /api/groups?q=majestic`
- `GET /api/groups/:idOrCode`
- `POST /api/groups`
- `PUT /api/groups/:idOrCode`
- `PATCH /api/groups/:idOrCode`
- `DELETE /api/groups/:idOrCode`
- `GET /api/invoices`
- `GET /api/invoices/clients`
- `POST /api/invoices`

`GET /api/health` returns `dataSource` so you can verify backend runs in `memory` or `prisma` mode.
