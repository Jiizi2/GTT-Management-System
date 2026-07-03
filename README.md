# GTT Management System

> Dashboard operasional Umrah untuk tim internal **Ghaniya Tour and Travel**.

Monorepo ini berisi aplikasi web untuk monitoring grup perjalanan, penyusunan itinerary, checklist keberangkatan, tracking visa & hotel agreement, manajemen invoice, serta administrasi user dan master data.

---

## Arsitektur

```
Browser ──→ Frontend (React SPA)
               │
               │  credentials: "include" (cookie-based)
               ▼
            Backend (NestJS REST API)
               │
               ├─ DATA_SOURCE=memory   → In-memory store (dev)
               └─ DATA_SOURCE=prisma   → PostgreSQL (production)
```

Monorepo memakai **npm workspaces** (`apps/*`):

| Workspace | Lokasi | Stack |
|---|---|---|
| Frontend | `apps/frontend/` | React 19 · TypeScript · Tailwind CSS 3 · esbuild · TanStack Query · React Router v7 |
| Backend | `apps/backend/` | NestJS 11 · TypeScript · Prisma ORM · PostgreSQL 16 |

---

## Modul Fitur

| Modul | Deskripsi |
|---|---|
| **Overview** | Statistik, daftar grup, pencarian, filter aktif/non-aktif |
| **Add New Group** | Wizard pembuatan grup dengan itinerary dan data visa awal |
| **Group Detail** | Detail lengkap grup: itinerary builder, timeline, notes, visa, checklist |
| **H-1 Checklist** | Tugas keberangkatan dekat (driver/bus assignment) |
| **Visa Tracking** | Status visa, hotel agreement Makkah/Madinah, jadwal Raudhah |
| **Agreement Inbox** | Kelola dan assign hotel agreement draft ke grup |
| **Invoice** | Daftar invoice, relasi client/grup, create/update/export invoice |
| **Raudhah Reminder** | Ringkasan appointment Raudhah dan status cetak tasreh |
| **User Management** | CRUD akun operasional (super-admin only) |
| **Master Data** | Kelola opsi kategori master data (super-admin only) |
| **Profile** | Pengaturan profil operator |

### Peran Pengguna

| Role | Akses |
|---|---|
| `super-admin` | Akses penuh termasuk User Management dan Master Data |
| `admin` | Akses operasional standar |
| `finance-manager` | Akses operasional standar |
| `customer-support` | Akses operasional standar |

---

## Quick Start

### Prasyarat

- Node.js ≥ 20
- Docker (opsional, hanya untuk PostgreSQL lokal)

### 1) Install dependencies

```bash
npm install
```

### 2) Jalankan backend (mode memory — tanpa database)

```bash
npm run dev:backend
```

Backend aktif di `http://localhost:3001/api`.

### 3) Jalankan frontend

```bash
npm run dev:frontend
```

Frontend aktif di `http://localhost:4173`.

> **Tip**: Mode memory cukup untuk development sehari-hari. Data tidak persisten antar restart.

### 4) (Opsional) Jalankan dengan PostgreSQL

Untuk data persisten menggunakan Prisma + PostgreSQL:

```bash
# Naikkan PostgreSQL lokal
docker compose up -d

# Buat file env backend
cp apps/backend/.env.example apps/backend/.env
```

Isi minimal `apps/backend/.env`:

```env
PORT=3001
DATA_SOURCE=prisma
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6543/gtt_ops?schema=public"
AUTH_BOOTSTRAP_DEFAULT_USERS="true"
DEV_AUTH_SUPERADMIN_PASSWORD="DevSuperAdmin#2026"
DEV_AUTH_ADMIN_PASSWORD="DevAdmin#2026"
```

Lalu generate client, cek status migration, terapkan migration, dan seed:

```bash
npm run db:generate:backend
npm run db:status:backend
npm run db:deploy:backend
npm run db:seed:backend
npm run dev:backend
```

---

## Script Penting

### Development

| Script | Keterangan |
|---|---|
| `npm run dev:frontend` | Jalankan frontend dev server |
| `npm run dev:backend` | Jalankan backend dev server |
| `npm run check` | Type-check semua workspace |
| `npm run build` | Build semua workspace |
| `npm run lint:frontend` | Lint frontend (ESLint) |
| `npm run format:frontend` | Format frontend (Prettier) |

### Testing

Semua test menggunakan **Vitest** dengan auto-discovery. Tidak perlu rebuild TypeScript untuk menjalankan test.

| Script | Keterangan |
|---|---|
| `npm run test` | Unit test semua workspace |
| `npm run test:unit` | Unit test semua workspace (alias) |
| `npm run test:smoke` | Smoke test frontend |
| `npm run test:api` | Backend API e2e (mode memory) |
| `npm run test:integration` | Integration test backend (butuh PostgreSQL) |
| `npm run test:e2e:frontend` | Playwright e2e frontend + backend build |
| `npm run test:unit:coverage` | Unit test dengan coverage report |
| `npm run test:unit:coverage:check` | Unit test dengan coverage threshold enforcement |

#### Coverage Thresholds

- **Backend**: 60% lines, 68% functions, 62% branches
- **Frontend**: 35% lines, 35% functions, 30% branches

#### Test Structure

**Backend** (`apps/backend/`):
- Unit tests: `src/**/*.test.ts` (co-located dengan source)
- Shared utilities: `src/test/` (runCase, withEnv, withDataSource, dll)
- Integration tests: `src/e2e/*.test.ts` (exclude dari unit test)

**Frontend** (`apps/frontend/`):
- Unit tests: `src/unit/**/*.test.ts`
- Smoke tests: `src/smoke/**/*.test.ts`
- E2E tests: `e2e/**/*.spec.ts` (Playwright)
- Shared utilities: `src/test/` (runCase, withMockFetch, withMockWindow, dll)

#### Writing Tests

```typescript
// Backend example
import { describe, expect } from 'vitest';
import { runCase } from '../test/run-case';
import { withEnv } from '../test/with-env';

describe('MyService', () => {
  runCase('should do something', async () => {
    await withEnv({ DATA_SOURCE: 'memory' }, async () => {
      const result = await myService.doSomething();
      expect(result).toBe(expected);
    });
  });
});

// Frontend example
import { describe, expect } from 'vitest';
import { runCase } from '../test/run-case';
import { withMockFetch } from '../test/with-mock-fetch';

describe('useMyHook', () => {
  runCase('should fetch data', async () => {
    await withMockFetch(
      async () => new Response(JSON.stringify({ data: 'test' })),
      async (calls) => {
        const result = await fetchData();
        expect(result.data).toBe('test');
        expect(calls.length).toBe(1);
      }
    );
  });
});
```

### QA

| Script | Keterangan |
|---|---|
| `npm run qa` | QA cepat: verify + smoke + API e2e |
| `npm run qa:full` | QA penuh: `qa` + integration + Playwright e2e |
| `npm run verify` | check + test + build |

### Database

| Script | Keterangan |
|---|---|
| `npm run db:generate:backend` | Generate Prisma client |
| `npm run db:status:backend` | Cek status migration database backend |
| `npm run db:deploy:backend` | Terapkan migration yang sudah ada secara deploy-safe |
| `npm run db:migrate:backend` | Buat/jalankan migrasi saat development schema baru |
| `npm run db:seed:backend` | Seed data awal |
| `npm run db:studio:backend` | Buka Prisma Studio |

---

## Deployment (VPS + Docker Compose)

Stack production terdiri dari tiga container:

| Service | Fungsi |
|---|---|
| `web` | Nginx — serve frontend static + reverse proxy `/api` ke backend |
| `backend` | NestJS production (port internal 3001) |
| `postgres` | PostgreSQL 16 dengan volume persisten |

### Deploy Singkat

```bash
# 1. Siapkan file env
cp compose.production.example.env .env
cp apps/backend/env.production.compose.example apps/backend/.env
# → Edit kedua file sesuai server

# 2. Build image
docker compose -f docker-compose.prod.yml build

# 3. Jalankan migrasi
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy

# 4. Bootstrap super admin pertama (hanya sekali)
docker compose -f docker-compose.prod.yml run --rm backend \
  npm run auth:bootstrap:superadmin -- \
  --name "Owner" --email "owner@example.com" --password "StrongPassword#2026"

# 5. Naikkan stack
docker compose -f docker-compose.prod.yml up -d
```

### Update Aplikasi

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy
docker compose -f docker-compose.prod.yml up -d
```

> Dokumentasi deployment lengkap: [deployment-vps-docker.md](docs/deployment-vps-docker.md)

---

## Keamanan

- `AuthGuard` global — semua endpoint terproteksi kecuali yang ditandai `@Public()`
- Session via **HttpOnly cookie** (`SameSite=Lax`, `Secure` di production)
- Bearer token didukung untuk kompatibilitas internal/test
- Proteksi CSRF berbasis origin untuk write request
- Login rate limiter (in-memory atau persisten via PostgreSQL)
- Global throttling via `@nestjs/throttler`
- Security headers via `helmet`

---

## API Documentation

- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs/json`
- Health check: `GET /api/health`

---

## Struktur Repositori

```
GTT-Management-System/
├── apps/
│   ├── frontend/                    # React SPA
│   │   ├── src/
│   │   │   ├── app.tsx              # Auth gate + top-level routing
│   │   │   ├── index.tsx            # React entry point
│   │   │   ├── styles.css           # Global CSS + design tokens (serene theme)
│   │   │   ├── components/          # Komponen UI reusable (15 file)
│   │   │   ├── pages/               # Halaman per modul (26 file)
│   │   │   ├── hooks/               # Custom hooks + business logic
│   │   │   │   └── app-controller/  # Sub-controller dashboard
│   │   │   ├── shared/              # Domain types, API client, routes, query keys
│   │   │   └── theme/               # Dark/light mode provider
│   │   ├── e2e/                     # Playwright e2e tests
│   │   ├── tailwind.config.cjs      # Tailwind config (serene theme)
│   │   └── playwright.config.ts
│   │
│   └── backend/                     # NestJS REST API
│       ├── src/
│       │   ├── main.ts              # Bootstrap NestJS
│       │   ├── app.module.ts        # Root module
│       │   ├── auth/                # Autentikasi & otorisasi
│       │   ├── groups/              # Domain utama (layered architecture)
│       │   │   ├── http/            # Controllers
│       │   │   ├── application/     # Business logic (services)
│       │   │   ├── domain/          # Pure domain functions
│       │   │   ├── infrastructure/  # Memory store + Prisma builders
│       │   │   └── dto/             # Data Transfer Objects
│       │   ├── invoices/            # Invoice management
│       │   ├── master-data/         # Master data (lookup options)
│       │   ├── prisma/              # Prisma service shared
│       │   ├── health/              # Health check endpoint
│       │   ├── throttling/          # Rate limiting
│       │   └── runtime-maintenance/ # Maintenance mode
│       ├── prisma/
│       │   ├── schema.prisma        # Database schema (17 model, 8 enum)
│       │   ├── seed.ts              # Seed data
│       │   └── migrations/          # Prisma migrations
│       └── Dockerfile               # Production backend image
│
├── deploy/
│   └── web/
│       ├── Dockerfile               # Frontend Nginx image
│       └── nginx.conf               # Reverse proxy config
│
├── docs/                            # Dokumentasi teknis
│   ├── application-overview.md
│   ├── codebase-walkthrough.md
│   ├── frontend.md
│   ├── backend.md
│   ├── frontend-design-guidelines.md
│   ├── deployment-vps-docker.md
│   ├── docker-command-cheatsheet.md
│   ├── qa.md
│   └── release-flow.md
│
├── docker-compose.yml               # Dev PostgreSQL lokal (port 6543)
├── docker-compose.prod.yml          # Stack production (web + backend + postgres)
├── package.json                     # Root workspace + script shortcut
├── tsconfig.base.json               # Shared TypeScript config
└── CONTRIBUTING.md                  # Branch & PR flow
```

---

## Release Flow

1. Buat feature branch dari `develop`.
2. Jalankan `npm run qa` sebelum commit.
3. Buka PR ke `develop`.
4. Untuk release, buka PR dari `develop` ke `master`/`main`.
5. Jalankan `npm run qa:full` sebelum merge release.

> CI GitHub Actions saat ini dinonaktifkan — validasi dijalankan secara manual sebelum merge.

### Git Hooks

Push guard terhadap branch protected (`develop`, `master`, `main`):

```bash
git config core.hooksPath .githooks
```

---

## Dokumentasi Lengkap

| Dokumen | Deskripsi |
|---|---|
| [Gambaran Aplikasi](docs/application-overview.md) | Arsitektur, modul fitur, alur data |
| [Peta Kodebase](docs/codebase-walkthrough.md) | Navigasi cepat untuk developer baru |
| [Frontend](docs/frontend.md) | Stack, komponen, hooks, design system |
| [Frontend Design Guidelines](docs/frontend-design-guidelines.md) | Pedoman konsistensi visual |
| [Backend](docs/backend.md) | Stack, modul, endpoint, database schema |
| [Deploy VPS + Docker](docs/deployment-vps-docker.md) | Panduan deploy bertahap ke VPS |
| [Docker Cheat Sheet](docs/docker-command-cheatsheet.md) | Command Docker yang sering dipakai |
| [QA Workflow](docs/qa.md) | Jalur QA cepat dan penuh |
| [Release Flow](docs/release-flow.md) | Branch strategy dan manual verification |
| [Contributing](CONTRIBUTING.md) | Branch & PR flow, push guard |
