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
   - By default this is non-destructive and only seeds missing defaults (including auth users).
   - To reset and reseed explicitly:
     - macOS/Linux: `SEED_RESET=true npm run db:seed --workspace backend`
     - PowerShell: `$env:SEED_RESET="true"; npm run db:seed --workspace backend`
8. Start backend:
   - `npm run dev:backend`

## Production Env Template

- Use `env.production.example` as production reference.
- Recommended flow:
  1. Copy `env.production.example` to `.env` on production host.
  2. Set real `DATABASE_URL`, `AUTH_SECRET`, and `CORS_ORIGINS`.
  3. Keep `AUTH_BOOTSTRAP_DEFAULT_USERS=false` in production.

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

## Runtime Validation

- `PORT` must be a numeric value between `1` and `65535`.
- `DATA_SOURCE` must be either `memory` or `prisma`.
- `DATA_SOURCE=prisma` is mandatory in production (`NODE_ENV=production`).
- `DATABASE_URL` is required when `DATA_SOURCE=prisma`.
- `AUTH_SECRET` is required in production and should be a private random value.
- `AUTH_BOOTSTRAP_DEFAULT_USERS` controls auto-creation of default auth users on startup in Prisma mode.
  - Defaults to `true` outside production.
  - Defaults to `false` in production.
- Development login password defaults can be overridden by:
  - `DEV_AUTH_SUPERADMIN_PASSWORD`
  - `DEV_AUTH_ADMIN_PASSWORD`

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
- Akun default ini disimpan di tabel `AuthUser` (via seed atau bootstrap auth di Prisma mode).

## API Base URL

- `http://localhost:3001/api`

## Initial Endpoints

- `GET /api/health`
- `POST /api/auth/login`
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
