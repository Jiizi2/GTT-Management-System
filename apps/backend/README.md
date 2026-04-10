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
   - By default this is non-destructive and only seeds when the database is empty.
   - To reset and reseed explicitly:
     - macOS/Linux: `SEED_RESET=true npm run db:seed --workspace backend`
     - PowerShell: `$env:SEED_RESET="true"; npm run db:seed --workspace backend`
8. Start backend:
   - `npm run dev:backend`

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
- Prisma integration test (real database required):
  - `npm run test:integration --workspace backend`

## Runtime Validation

- `PORT` must be a numeric value between `1` and `65535`.
- `DATA_SOURCE` must be either `memory` or `prisma`.
- `DATABASE_URL` is required when `DATA_SOURCE=prisma`.
- `AUTH_SECRET` should be set to a private random value.
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

## API Base URL

- `http://localhost:3001/api`

## Initial Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/session`
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
