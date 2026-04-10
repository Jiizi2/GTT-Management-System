# Ghaniya Tour and Travel Ops Monorepo

Monorepo ini berisi aplikasi operasional perjalanan/umrah dengan dua aplikasi utama:

- `apps/frontend`: dashboard web untuk tim operasional.
- `apps/backend`: REST API untuk autentikasi, grup perjalanan, invoice, dan master data.

## Dokumentasi

- [Aplikasi secara umum](docs/application-overview.md)
- [Frontend](docs/frontend.md)
- [Backend](docs/backend.md)
- [Release flow](docs/release-flow.md)

## Stack Utama

- Frontend: React 19, TypeScript, Tailwind CSS, esbuild, Playwright.
- Backend: NestJS 11, TypeScript, Prisma, PostgreSQL.
- Workspace: npm workspaces (`apps/*`).

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Jalankan backend (mode memory)

Mode default backend adalah `memory` (tanpa database persisten).

```bash
npm run dev:backend
```

Backend aktif di `http://localhost:3001/api`.

### 3) Jalankan frontend

```bash
npm run dev:frontend
```

Frontend aktif di `http://localhost:4173`.

## Menjalankan Backend dengan PostgreSQL (Prisma)

1. Jalankan database lokal:

```bash
docker compose up -d
```

2. Buat file `apps/backend/.env` dengan nilai minimal:

```env
PORT=3001
DATA_SOURCE=prisma
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6543/gtt_ops?schema=public"
```

3. Generate client, migrate, dan seed:

```bash
npm run db:generate:backend
npm run db:migrate:backend
npm run db:seed:backend
```

4. Jalankan backend:

```bash
npm run dev:backend
```

## Script Penting

- `npm run check` -> type-check semua workspace.
- `npm run test` -> unit test semua workspace.
- `npm run build` -> build semua workspace.
- `npm run verify` -> check + test + build.
- `npm run test:integration` -> integration test backend (butuh DB).
- `npm run test:e2e:frontend` -> e2e frontend + backend build.
